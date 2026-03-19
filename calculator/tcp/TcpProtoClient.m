classdef TcpProtoClient < handle
    % TcpProtoClient
    % 使用 TCP 的客户端封装
    %
    % 协议格式：
    %   "START" + packet_length(uint32) + action(uint32) + payload + "END"
    %
    % 说明：
    % - packet_length、action 都是 uint32，大端
    % - packet_length 的含义：从 packet_length 字段开始直到 END 结束（包含 packet_length 自身、action、payload、END）的总字节数
    % - START/END 为 ASCII 字节序列
    %
    % 回调函数签名：
    %   cb(this, action, payload)

    properties (SetAccess=private)
        Host (1,1) string
        Port (1,1) double
    end

    properties (Access=private)
        Client
        Callback

        % —— 负载元素类型（枚举）——
        PayloadType (1,1) PayloadType = PayloadType.DOUBLE

        % 接收缓冲区
        Rx (1,:) uint8 = uint8([])
    end

    properties (Constant, Access=private)
        START = uint8('START')  % 5 字节
        END   = uint8('END')    % 3 字节
    end

    methods
        function this = TcpProtoClient(host, port, dataCallback)
            arguments
                host (1,1) string
                port (1,1) double {mustBeInteger, mustBePositive}
                dataCallback (1,1) function_handle
            end
            this.Host = host;
            this.Port = port;
            this.Callback = dataCallback;
        end

        function setPayloadType(this, t)
            % 设置 payload 元素类型（枚举）
            arguments
                this
                t (1,1) PayloadType
            end
            this.PayloadType = t;
        end

        function connect(this)
            % 仅实现 TCP 客户端连接
            if ~isempty(this.Client)
                error("TcpProtoClient:AlreadyConnected", "已经连接过了。");
            end

            this.Client = tcpclient(this.Host, this.Port, ...
                "Timeout", 5, ...
                "ByteOrder", "big-endian");

            % 一旦有数据到达就触发回调（按字节触发，内部做缓冲/拼包）
            configureCallback(this.Client, "byte", 1, @(src,evt)this.onBytes(src,evt));
        end

        function close(this)
            % 主动关闭连接并清理资源
            if isempty(this.Client)
                return;
            end
            try
                configureCallback(this.Client, "off");
            catch
            end
            try
                clear this.Client; %#ok<CLSCR>
            catch
            end
            this.Client = [];
            this.Rx = uint8([]);
        end

        function delete(this)
            % 析构时确保关闭连接
            this.close();
        end

        function emit(this, action, payload)
            % emit(action, payload)：按协议发送一帧
            %
            % action：uint32 标量（禁止隐式转换）
            % payload：向量，且元素类型必须与 PayloadType 完全一致（禁止隐式转换）

            if isempty(this.Client)
                error("TcpProtoClient:NotConnected", "请先调用 connect()。");
            end

            % 严格校验 action 类型
            if ~(isa(action, "uint32") && isscalar(action))
                error("TcpProtoClient:BadAction", "action 必须是 uint32 标量（禁止隐式转换）。");
            end

            % 严格校验 payload 类型（禁止隐式转换）
            wantClass = this.PayloadType.toClassName();
            if ~isa(payload, wantClass)
                error("TcpProtoClient:BadPayloadType", ...
                    "payload 必须是 %s 类型（禁止隐式转换）。", wantClass);
            end
            if ~isvector(payload)
                error("TcpProtoClient:BadPayloadShape", "payload 必须是向量。");
            end

            payloadBytes = this.packPayload(payload);

            % packet_length 包含：length(u32) + action(u32) + payloadBytes + END(3)
            packetLength = uint32(4 + 4 + numel(payloadBytes) + numel(this.END));
            lenBytes = this.u32be(packetLength);
            actBytes = this.u32be(action);

            frame = [this.START, lenBytes, actBytes, payloadBytes, this.END];
            write(this.Client, frame, "uint8");
        end
    end

    methods (Access=private)
        function onBytes(this, src, ~)
            % 收到字节后放入接收缓冲，并尽可能多地解析完整帧
            n = src.NumBytesAvailable;
            if n <= 0
                return;
            end
            newData = read(src, n, "uint8");
            this.Rx = [this.Rx, newData];

            while true
                [ok, action, payload, consumed] = this.tryParseOneFrame(this.Rx);
                if ~ok
                    break;
                end

                if consumed > 0
                    this.Rx = this.Rx(consumed+1:end);
                else
                    this.Rx = uint8([]);
                end

                % cb(this, action, payload)
                if ~isempty(payload) || action ~= 0
                    this.Callback(this, action, payload);
                end
            end
        end

        function [ok, action, payload, consumed] = tryParseOneFrame(this, buf)
            % 尝试从 buf 中解析一帧；成功则返回 ok=true，并返回 action/payload 以及 consumed
            ok = false; action = uint32(0); payload = []; consumed = 0;

            if numel(buf) < (numel(this.START) + 4 + 4 + numel(this.END))
                return;
            end

            startIdx = this.findSub(buf, this.START);
            if startIdx == 0
                consumed = numel(buf);
                ok = true;
                action = uint32(0);
                payload = [];
                return;
            end

            if numel(buf) < startIdx - 1 + numel(this.START) + 4
                return;
            end

            lenPos = startIdx + numel(this.START);
            packetLen = this.readU32be(buf, lenPos);

            totalFrameLen = numel(this.START) + double(packetLen);
            if numel(buf) < (startIdx - 1 + totalFrameLen)
                return;
            end

            frameStart = startIdx;
            frameEnd = startIdx - 1 + totalFrameLen;
            frame = buf(frameStart:frameEnd);

            if ~isequal(frame(end-numel(this.END)+1:end), this.END)
                consumed = frameStart;
                ok = true;
                return;
            end

            actPosInFrame = numel(this.START) + 4 + 1;
            actPosInBuf = frameStart + actPosInFrame - 1;
            action = this.readU32be(buf, actPosInBuf);

            payloadStartInFrame = numel(this.START) + 4 + 4 + 1;
            payloadEndInFrame = numel(frame) - numel(this.END);
            payloadBytes = frame(payloadStartInFrame:payloadEndInFrame);

            payload = this.unpackPayload(payloadBytes);

            consumed = frameEnd;
            ok = true;
        end

        function idx = findSub(~, buf, pat)
            % 返回 pat 在 buf 中首次出现的 1-based 索引；找不到返回 0
            idx = 0;
            nb = numel(buf); np = numel(pat);
            if np == 0 || nb < np, return; end
            for i = 1:(nb-np+1)
                if isequal(buf(i:i+np-1), pat)
                    idx = i; return;
                end
            end
        end

        function b = packPayload(this, payload)
            % 将 payload 按选定类型打包成大端字节序
            wantClass = this.PayloadType.toClassName();
            b = this.packNumericBE(payload, wantClass);
        end

        function payload = unpackPayload(this, bytes)
            % 将字节流按选定类型解包成向量，并校验字节长度必须为元素大小的整数倍
            elemSize = this.PayloadType.elementBytes();
            if mod(numel(bytes), elemSize) ~= 0
                error("TcpProtoClient:BadPayloadBytes", ...
                    "payload 字节长度（%d）不是元素大小（%d）的整数倍。", ...
                    numel(bytes), elemSize);
            end

            wantClass = this.PayloadType.toClassName();
            payload = this.unpackNumericBE(bytes, wantClass);
        end

        function bytes = packNumericBE(~, x, typeName)
            % x 已经是正确类型；这里仅做按元素大端序重排并转成 uint8
            x = x(:);
            switch typeName
                case {"uint32","int32"}
                    raw = typecast(x, "uint8");
                    raw = reshape(raw, 4, []).';
                    raw = fliplr(raw);
                    bytes = reshape(raw.', 1, []);
                case "double"
                    raw = typecast(x, "uint8");
                    raw = reshape(raw, 8, []).';
                    raw = fliplr(raw);
                    bytes = reshape(raw.', 1, []);
                otherwise
                    error("TcpProtoClient:Internal", "不支持的打包类型。");
            end
            bytes = uint8(bytes);
        end

        function x = unpackNumericBE(~, bytes, typeName)
            % 将大端字节序转换为平台端序后再 typecast
            bytes = uint8(bytes(:));
            switch typeName
                case {"uint32","int32"}
                    raw = reshape(bytes, 4, []).';
                    raw = fliplr(raw);
                    raw = reshape(raw.', [], 1);
                    x = typecast(raw, typeName);
                case "double"
                    raw = reshape(bytes, 8, []).';
                    raw = fliplr(raw);
                    raw = reshape(raw.', [], 1);
                    x = typecast(raw, "double");
                otherwise
                    error("TcpProtoClient:Internal", "不支持的解包类型。");
            end
        end

        function b = u32be(~, x)
            % 将 uint32 标量转为大端字节序（4 字节）
            raw = typecast(uint32(x), "uint8");
            b = fliplr(raw);
            b = uint8(b);
        end

        function x = readU32be(~, buf, pos)
            % 从 buf(pos:pos+3) 读取一个大端 uint32
            raw = uint8(buf(pos:pos+3));
            raw = flipud(raw(:));
            x = typecast(raw, "uint32");
        end
    end
end
