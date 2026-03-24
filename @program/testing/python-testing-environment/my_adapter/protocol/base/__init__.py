from enum import Enum

class PayloadKind(Enum):
    KEEP_ALIVE = 1
    KEEP_ALIVE_RESPONSE = 2
    DATA_FRAME = 3

    @classmethod
    def from_int(cls, value: int) -> "PayloadKind":
        return cls(value)
