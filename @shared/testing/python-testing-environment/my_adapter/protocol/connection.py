import asyncio
import socket
import struct
from traceback import print_exc
from typing import Coroutine, Literal, Protocol

from ..common import debug_output
from .base.encoder import ProtocolEncoder
from .base.packet import AbstractPayload
from .payloads.keep_alive import KeepAlivePayload, KeepAliveResponsePayload

NetworkKind = Literal["tcp", "udp"]


class ProtocolCallback(Protocol):
    def __call__(
        self, payload: AbstractPayload, metadata: dict | None
    ) -> None | Coroutine: ...


class ProtocolServer:
    """
    一个简单的协议服务器
    支持 TCP 和 UDP，服务器和客户端模式
    仅支持一个链接，异步执行
    """

    port: int

    def __init__(
        self,
        agent: str,
        agent_id: int,
        kind: NetworkKind = "tcp",
    ):
        self.encoder = ProtocolEncoder(agent, agent_id)
        self.kind = kind
        self._on_data_received: list[ProtocolCallback] = []

        self.server = None
        self.sock = None

    def on_data_received(self, callback: ProtocolCallback):
        self._on_data_received.append(callback)

    async def start(self, port: int = 0):
        """
        启动服务器
        """
        sock = self._make_socket()
        self.server = sock

        sock.bind(("::", port))

        if self.kind == "tcp":
            sock.listen(1)

        address = sock.getsockname()
        self.port = address[1]

        debug_output(f"Starting {self.kind.upper()} server on {self.port}...")

        self.task = asyncio.ensure_future(self.start_server_event_loop())

    async def join(self):
        if self.task is not None:
            await self.task

    async def start_server_event_loop(self):
        if self.kind == "tcp":
            conn, addr = await self._accept(self.server)

            debug_output(f"Accepted connection from {addr}")
            self.sock = conn
            await self.start_event_loop(conn)
            self.sock = None
        else:
            self.sock = self.server
            assert self.sock is not None, "Socket does not ready"
            await self.start_event_loop(self.sock)

    async def connect(self, address: str, port: int):
        """
        启动客户端
        """

        sock = self._make_socket()
        sock.connect((address, port))

        debug_output(f"Connected to {address}:{port} via {self.kind.upper()}")

        self.sock = sock
        await self.start_event_loop(sock)

    def _make_socket(self):
        assert self.sock is None, "Socket already exists"
        assert self.server is None, "Server already exists"

        if self.kind == "tcp":
            type = socket.SOCK_STREAM
        elif self.kind == "udp":
            type = socket.SOCK_DGRAM
        else:
            raise ValueError(f"Unsupported network kind: {self.kind}")

        sock = socket.socket(family=socket.AF_INET6, type=type)
        sock.setblocking(False)
        return sock

    async def _accept(self, sock):
        loop = asyncio.get_running_loop()
        return await loop.sock_accept(sock)

    async def send(self, payload: AbstractPayload, metadata: dict | None = None):
        assert self.sock is not None, "Socket does not ready"

        packet = self.encoder.encode(payload, metadata)

        # debug_dump_buffer(packet, ">>> ")

        loop = asyncio.get_running_loop()
        await loop.sock_sendall(self.sock, packet)

    async def start_event_loop(self, sock: socket.socket):
        assert sock is not None, "Socket does not ready"

        loop = asyncio.get_running_loop()

        data: bytes = b""

        if self.kind == "udp":
            ndata, address = await loop.sock_recvfrom(sock, 10240)
            debug_output(f"[UDP] Received first packet from {address}")
            sock.connect(address)
            data = ndata

        try:
            while True:
                while len(data) > 4:
                    packet_length = struct.unpack_from("!I", data)[0]

                    if len(data) < 4 + packet_length:
                        break

                    await self.work_on_packet(data[4 : 4 + packet_length])
                    data = data[4 + packet_length :]

                ndata = await loop.sock_recv(sock, 10240)

                if not ndata:
                    debug_output("链接被对方关闭")
                    break

                data += ndata

        except Exception:
            debug_output(f"事件循环中发生错误:")
            print_exc()

    async def work_on_packet(self, data):

        # debug_output(f"完整数据包! (长度: {packet_length} / {len(data)})")
        # debug_dump_buffer(data[0 : 4 + packet_length], "<<< ")

        packet = self.encoder.decode(data)

        # decode_micros = time.time_ns() // 1000

        if p := packet.try_get_payload(KeepAlivePayload):
            debug_output(
                f"Keep alive request received <{p.timestamp}>, sending response..."
            )
            await self.send(KeepAliveResponsePayload())
        elif packet.try_get_payload(KeepAliveResponsePayload):
            debug_output("Keep alive response received")
        else:
            # debug_output(f"Data frame received! ({packet.get_type()})")
            for callback in self._on_data_received:
                r = callback(packet.payload, metadata=packet.metadata)
                if r is not None:
                    await r
                # now = time.time_ns() // 1000

                # print(
                #     f"事件循环: 接收数据包 ({packet.get_type()})，接收耗时 {decode_micros - start_micros} ，处理耗时 {now - decode_micros}",
                #     file=sys.stderr,
                #     flush=True,
                # )
