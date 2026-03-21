import struct
from typing import Self

import numpy
from numpy.typing import NDArray

from ..base import PayloadKind
from ..base.packet import AbstractPayload
from ..helpers.dtype import get_dtype, get_pack_format_from_dtype

_fmt = struct.Struct("!IQcBI4s")


class DataFramePayload(AbstractPayload):
    def __init__(
        self,
        content: NDArray,
        rate: int = 0,
        timestamp: int = 0,
        function: int = 0,
    ):
        super().__init__()

        assert content.ndim == 1, "在网络环境中仅支持一维数组"

        self.content = content
        self.rate = rate
        self.timestamp = timestamp
        self.function = function

    def get_type(self) -> PayloadKind:
        return PayloadKind.DATA_FRAME

    @property
    def type(self) -> str:
        if self.content.dtype.name.startswith("int"):
            return "s"
        elif self.content.dtype.name.startswith("uint"):
            return "u"
        elif self.content.dtype.name.startswith("float"):
            return "f"
        raise ValueError(f"不支持的数据类型: {self.content.dtype.name}")

    @property
    def bit_depth(self) -> int:
        return self.content.dtype.itemsize * 8

    def serialize(self) -> bytes:
        header = _fmt.pack(
            self.function, self.timestamp, self.type, self.bit_depth, self.rate, b"DATA"
        )

        size = self.content.size
        f = get_pack_format_from_dtype(self.content.dtype)

        return header + struct.pack(f"!{size}{f}", self.content)

    @classmethod
    def deserialize(cls, data: bytes) -> Self:
        (function, timestamp, type, bit_depth, rate, header) = _fmt.unpack_from(data)

        assert header == b"DATA", "数据包格式错误（头部结尾不是DATA）"

        content = numpy.frombuffer(
            data[_fmt.size :], dtype=get_dtype(type, bit_depth).newbyteorder(">")
        )

        return cls(content=content, rate=rate, timestamp=timestamp, function=function)
