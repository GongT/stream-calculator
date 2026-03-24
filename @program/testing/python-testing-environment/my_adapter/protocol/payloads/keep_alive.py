import struct
from abc import ABC
from typing import Self

from ..base import PayloadKind
from ..base.packet import AbstractPayload
from ..helpers.timestamp import get_microseconds
from . import register_payload_class


class __KeepAliveBase(AbstractPayload, ABC):
    def __init__(self, timestamp=get_microseconds()):
        super().__init__()

        self.timestamp = timestamp

    def serialize(self) -> bytes:
        return struct.pack("!Q", self.timestamp)

    @classmethod
    def deserialize(cls, data: bytes) -> Self:
        val = struct.unpack_from("!Q", data, 0)[0]
        return cls(val)


@register_payload_class
class KeepAlivePayload(__KeepAliveBase):
    def get_type(self) -> PayloadKind:
        return PayloadKind.KEEP_ALIVE


@register_payload_class
class KeepAliveResponsePayload(__KeepAliveBase):
    def get_type(self) -> PayloadKind:
        return PayloadKind.KEEP_ALIVE_RESPONSE
