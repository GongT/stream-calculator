classdef PayloadType
    % 负载元素类型枚举（同一个 app 只使用其中一种）
    enumeration
        UINT32
        INT32
        DOUBLE
    end

    methods
        function s = toClassName(this)
            % 返回 MATLAB 类型名（用于 isa 严格校验）
            switch this
                case PayloadType.UINT32
                    s = "uint32";
                case PayloadType.INT32
                    s = "int32";
                case PayloadType.DOUBLE
                    s = "double";
                otherwise
                    error("PayloadType:BadValue", "未知的 PayloadType。");
            end
        end

        function n = elementBytes(this)
            % 返回单个元素占用的字节数
            switch this
                case {PayloadType.UINT32, PayloadType.INT32}
                    n = 4;
                case PayloadType.DOUBLE
                    n = 8;
                otherwise
                    error("PayloadType:BadValue", "未知的 PayloadType。");
            end
        end
    end
end
