import asyncio
import socket
import struct
from traceback import print_exc
from typing import Callable, Coroutine, Literal

from ..common import debug_dump_buffer, debug_output
from .base.encoder import ProtocolEncoder
from .base.packet import AbstractPayload
from .payloads.keep_alive import KeepAlivePayload, KeepAliveResponsePayload

NetworkKind = Literal["tcp", "udp"]


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
        self._on_data_received: list[Callable[[AbstractPayload], None]] = []

        self.server = None
        self.sock = None

    def on_data_received(self, callback: Callable[[AbstractPayload], None | Coroutine]):
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

    async def send(self, payload: AbstractPayload):
        assert self.sock is not None, "Socket does not ready"

        packet = self.encoder.encode(payload)

        debug_dump_buffer(packet, ">>> ")

        loop = asyncio.get_running_loop()
        await loop.sock_sendall(self.sock, packet)

    async def start_event_loop(self, sock: socket.socket):
        assert sock is not None, "Socket does not ready"

        loop = asyncio.get_running_loop()

        first_data = self.kind == "udp"

        data: bytes = b""
        while True:
            try:
                if first_data:
                    ndata, address = await loop.sock_recvfrom(sock, 10240)
                    first_data = False
                    debug_output(f"[UDP] Received first packet from {address}")
                    sock.connect(address)
                else:
                    ndata = await loop.sock_recv(sock, 10240)

                if not ndata:
                    debug_output("链接被对方关闭")
                    break

                data += ndata
                packet_length = struct.unpack_from("!I", data)[0]
                if len(data) < 4 + packet_length:
                    # debug_output(
                    #     f"数据包未完整接收，等待更多数据... (当前长度: {len(data)}, 预期长度: {4 + packet_length})"
                    # )
                    # debug_dump_buffer(data, "=== ")
                    continue

                # debug_output(f"完整数据包! (长度: {packet_length} / {len(data)})")
                # debug_dump_buffer(data[0 : 4 + packet_length], "<<< ")

                packet = self.encoder.decode(data[4 : 4 + packet_length])
                data = data[4 + packet_length :]

                if p := packet.try_get_payload(KeepAlivePayload):
                    debug_output(
                        f"Keep alive request received <{p.timestamp}>, sending response..."
                    )
                    await self.send(KeepAliveResponsePayload())
                elif packet.try_get_payload(KeepAliveResponsePayload):
                    debug_output("Keep alive response received")
                else:
                    debug_output(f"Data frame received! ({packet.get_type()})")
                    for callback in self._on_data_received:
                        await callback(packet.payload)
            except Exception:
                debug_output(f"事件循环中发生错误:")
                print_exc()
                break
