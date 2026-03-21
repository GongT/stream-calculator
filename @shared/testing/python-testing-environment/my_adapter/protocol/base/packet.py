import struct
from abc import ABC, abstractmethod
from typing import Self, TypeVar

from ...common import debug_output
from . import PayloadKind


class Serializable(ABC):
    @abstractmethod
    def serialize(self) -> bytes:
        pass

    @classmethod
    @abstractmethod
    def deserialize(cls, data: bytes) -> Self:
        pass


class AbstractPayload(Serializable, ABC):
    @abstractmethod
    def get_type(self) -> PayloadKind:
        pass

    T = TypeVar("T", bound="Serializable")

    def as_type(self, Type: type[T]) -> T:
        if not isinstance(self, Type):
            raise TypeError(f"Cannot cast {type(self)} to {Type}")
        return self


class NetworkPacket(Serializable):
    version: int = 1
    agent: str = ""
    agent_id: int = 0
    payload: AbstractPayload

    def __init__(
        self, agent: str, agent_id: int, payload: AbstractPayload | None = None
    ):
        self.agent = agent
        self.agent_id = agent_id
        if payload is not None:
            self.payload = payload

    def get_type(self) -> PayloadKind:
        return self.payload.get_type()

    T = TypeVar("T", bound="Serializable")

    def get_payload(self, Type: type[T]) -> T:
        r = self.try_get_payload(Type)
        if r is None:
            raise ValueError(f"Payload type mismatch: {type(self.payload)} != {Type}")
        return r

    def try_get_payload(self, Type: type[T]) -> T | None:
        if isinstance(self.payload, Type):
            return self.payload
        return None

    def serialize(self) -> bytes:
        # 获取 payload 序列化结果
        payload_bytes = self.payload.serialize()

        # 获取 action 码，根据 payload 类型
        action = int(self.payload.get_type().value)

        # 编码 agent 字符串
        agent_bytes = self.agent.encode("ascii")
        agent_length = len(agent_bytes)

        frame_length = (
            4  # frame_length 本身 uint32
            + 5  # START 标记
            + 1  # version uint8
            + 1  # agent_length uint8
            + agent_length  # sender_agent 字符串
            + 4  # sender_id uint32
            + 4  # action uint32
            + 4  # payload_length uint32
            + len(payload_bytes)  # payload 数据
            + 3  # END 标记
        )

        # 构建数据
        # 版本号 + agent 长度 + agent + agent_id + action + payload_length

        fmt = f"!I 5s B B {agent_length}s I I I {len(payload_bytes)}s 3s"
        buffer = struct.pack(
            fmt,
            frame_length - 4,  # frame_length 不包含自身的长度
            b"START",
            self.version,
            agent_length,
            agent_bytes,
            self.agent_id,
            action,
            len(payload_bytes),
            payload_bytes,
            b"END",
        )

        assert (
            len(buffer) == frame_length
        ), f"Frame length mismatch: expected {frame_length}, got {len(buffer)}"

        return buffer

    @classmethod
    def deserialize(cls, data: bytes) -> "NetworkPacket":
        offset = 0

        # START
        assert (
            data[offset : offset + 5] == b"START"
        ), f"Invalid packet: missing START marker @{str(offset)}+5 (got {data[offset : offset + 5]!r})"
        offset += 5

        # 解析版本号
        version = struct.unpack_from("!B", data, offset)[0]
        assert version == 1, f"Unsupported version: {str(version)}"
        offset += 1

        # 解析 agent 长度和 agent 字符串
        agent_length: int = struct.unpack_from("!B", data, offset)[0]
        offset += 1
        # debug_output(f"+{offset} | Agent length: {agent_length}")
        agent = data[offset : offset + agent_length].decode("ascii")
        offset += agent_length
        # debug_output(f"+{offset} | Agent: {agent}")

        # 解析 agent_id
        agent_id: int = struct.unpack_from("!I", data, offset)[0]
        offset += 4
        # debug_output(f"+{offset} | Agent ID: {str(agent_id)}")

        # 解析 action
        action_num: int = struct.unpack_from("!I", data, offset)[0]
        offset += 4
        action = PayloadKind.from_int(action_num)
        # debug_output(f"+{offset} | Action: {str(action)}")

        # 解析 payload_length 和 payload 数据
        payload_length: int = struct.unpack_from("!I", data, offset)[0]
        offset += 4
        # debug_output(f"+{offset} | Payload length: {str(payload_length)}")
        payload_data = data[offset : offset + payload_length]
        offset += payload_length
        # debug_output(f"+{offset} | Payload: {payload_data!r}")

        assert (
            data[offset:] == b"END"
        ), f"Invalid packet: missing END marker @{str(offset)}+3 (got {data[offset : ]!r})"

        # 根据 action 创建对应的 Payload 实例
        from ..payloads import get_payload_class_from_kind

        Class = get_payload_class_from_kind(action)
        payload = Class.deserialize(payload_data)

        return cls(agent=agent, agent_id=agent_id, payload=payload)
