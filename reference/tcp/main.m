function main(varargin)
    [host, port, bandStart, bandEnd, sampleRate] = resolveInputParams(nargin, varargin);
    fprintf("[参数] bandStart=%.2f, bandEnd=%.2f, sampleRate=%.2f\n", bandStart, bandEnd, sampleRate);

    cb = @(this, action, payload) dataHandler(this, action, payload, bandStart, bandEnd, sampleRate);

    c = TcpProtoClient(host, port, cb);

    % —— 选择一种 payload 元素类型（同一个 app 只用一种）——
    % c.setPayloadType(PayloadType.UINT32);
    % c.setPayloadType(PayloadType.INT32);
    c.setPayloadType(PayloadType.DOUBLE);

    fprintf("正在连接 %s:%d ...\n", host, port);
    c.connect();

    fprintf("连接成功\n");
    while true
        pause(0.1);
    end
end

function dataHandler(this, action, payload, bandStart, bandEnd, sampleRate)
    fprintf("[收到] action=%u，payload类型=%s，长度=%d\n", action, class(payload), numel(payload));
    % if ~isempty(payload)
    %     disp(payload(1:min(end, 10)));
    % end

    payload2 = bandvalueExtraction(payload, sampleRate, [bandStart bandEnd]);

    fprintf("[回发] action=%u，payload长度=%d\n", action, numel(payload2));
    this.emit(action, payload2);
end

function [host, port, bandStart, bandEnd, sampleRate] = resolveInputParams(argc, argv)
    % 1) 环境变量 HOST、PORT、BAND_START、BAND_END、SAMPLE_RATE
    host = getenv('HOST');
    port = str2double(getenv('PORT'));
    bandStart = str2double(getenv('BAND_START'));
    bandEnd = str2double(getenv('BAND_END'));
    sampleRate = str2double(getenv('SAMPLE_RATE'));

    % 2) （如果编译为 exe）命令行参数 --host、--port、--band-start、--band-end、--sample-rate
    if isdeployed
        for i = 1:2:argc
            if i+1 > argc
                break; % 避免越界
            end
            next_val = argv{i+1};
            switch argv{i}
                case '--host'
                    host = next_val;
                case '--port'
                    port = str2double(next_val);
                case '--band-start'
                    bandStart = str2double(next_val);
                case '--band-end'
                    bandEnd = str2double(next_val);
                case '--sample-rate'
                    sampleRate = str2double(next_val);
            end
        end
    end

    % 3) 如果没有HOST、PORT，则使用默认值 127.0.0.1，9000
    if isempty(host)
        host = '127.0.0.1';
    end
    if isnan(port)
        port = 9000;
    end

    % 4) 没有其他3个，则输出错误提示并退出
    if isnan(bandStart) || isnan(bandEnd) || isnan(sampleRate)
        error('必须提供 BAND_START、BAND_END 和 SAMPLE_RATE 参数。');
    end
end
