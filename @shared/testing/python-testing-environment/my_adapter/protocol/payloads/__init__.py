from ..base import PayloadKind
from ..base.packet import AbstractPayload
from .frame import DataFramePayload
from .keep_alive import KeepAlivePayload, KeepAliveResponsePayload


def get_payload_class_from_kind(kind: PayloadKind) -> type[AbstractPayload]:
    if kind == PayloadKind.KEEP_ALIVE:
        return KeepAlivePayload
    elif kind == PayloadKind.KEEP_ALIVE_RESPONSE:
        return KeepAliveResponsePayload
    elif kind == PayloadKind.DATA_FRAME:
        return DataFramePayload
    else:
        raise ValueError(f"Unsupported payload kind: {kind}")
