from typing import TYPE_CHECKING, TypeVar

from ..base import PayloadKind

if TYPE_CHECKING:
    from ..base.packet import AbstractPayload

payload_registry: dict[PayloadKind, type["AbstractPayload"]] = {}


def get_payload_class_from_kind(kind: PayloadKind) -> type["AbstractPayload"]:
    if kind not in payload_registry:
        raise ValueError(f"Unknown payload kind: {kind}")
    return payload_registry[kind]


T = TypeVar("T", bound=type["AbstractPayload"])


def register_payload_class(cls: T) -> T:
    instance = cls.__new__(cls)
    kind = instance.get_type()
    if kind in payload_registry:
        raise ValueError(
            f"Payload kind {kind} already registered for class {payload_registry[kind]}"
        )
    payload_registry[kind] = cls
    return cls
