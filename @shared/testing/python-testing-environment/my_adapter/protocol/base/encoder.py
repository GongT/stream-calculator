from .packet import AbstractPayload, NetworkPacket


class ProtocolEncoder:
    def __init__(self, agent: str, agent_id: int):
        self.agent = agent
        self.agent_id = agent_id

    def encode(self, payload: AbstractPayload, metadata: dict | None = None) -> bytes:
        packet = NetworkPacket(
            agent=self.agent, agent_id=self.agent_id, payload=payload, metadata=metadata
        )
        return packet.serialize()

    def decode(self, data: bytes) -> NetworkPacket:
        return NetworkPacket.deserialize(data)
