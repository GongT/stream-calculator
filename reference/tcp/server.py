import numpy as np
import argparse
import socket
import struct
import threading
import time
import random

# 最小调试服务器（带周期推送）：
# - 协议：START + length(u32) + action(u32) + payload + END（全部大端）
# - 客户端连接后：每 5 秒发送 1 帧，payload 为 10 个随机数
# - payload 元素类型通过 --ptype 选择（默认 double），需与 MATLAB 客户端一致
# - 同时也会解析并打印客户端发来的帧（便于调试）

START = b"START"
END = b"END"

def elem_format(ptype: str):
    # 根据 payload 元素类型返回 struct 格式与元素字节数（均为大端）
    if ptype == "uint32":
        return ">I", 4, np.uint32
    if ptype == "int32":
        return ">i", 4, np.int32
    if ptype == "double":
        return ">d", 4, np.float32
    raise ValueError("ptype 非法")

# 修改 build_frame 函数，确保使用 NumPy 类型处理 payload
def build_frame(action: int, payload, ptype: str) -> bytes:
    if not (0 <= action <= 0xFFFFFFFF):
        raise ValueError("action 超出 uint32 范围")

    if ptype == "uint32":
        pack_elem = lambda x: struct.pack(">I", np.uint32(x))
    elif ptype == "int32":
        pack_elem = lambda x: struct.pack(">i", np.int32(x))
    elif ptype == "double":
        pack_elem = lambda x: struct.pack(">d", np.float32(x))
    else:
        raise ValueError("ptype 非法")

    payload_bytes = b"".join(pack_elem(x) for x in payload)
    packet_len = 4 + 4 + len(payload_bytes) + len(END)  # length + action + payload + END
    return START + struct.pack(">I", packet_len) + struct.pack(">I", action) + payload_bytes + END

# 修改 make_random_payload 函数，生成 NumPy 类型的随机数
def make_random_payload(ptype: str, n: int):
    if ptype == "double":
        return np.random.uniform(-100.0, 100.0, n).astype(np.float32)
    if ptype == "uint32":
        return np.random.randint(0, 2**32, n, dtype=np.uint32)
    if ptype == "int32":
        return np.random.randint(-(2**31), 2**31, n, dtype=np.int32)
    raise ValueError("ptype 非法")

# 确保 make_test_signal 函数生成的信号是 NumPy 类型
def make_test_signal(ptype: str):
    Fs = 1024
    t = np.arange(0, 1, 1/Fs, dtype=np.float32)
    signal = np.sin(2 * np.pi * 100 * t) + np.sin(2 * np.pi * 500 * t)
    if ptype == "double":
        return signal.astype(np.float32)
    if ptype == "uint32":
        return signal.astype(np.uint32)
    if ptype == "int32":
        return signal.astype(np.int32)
    raise ValueError("ptype 非法")

# 修改 parse_frames_stream 函数，解析时将数据转换为 NumPy 类型
def parse_frames_stream(conn, ptype: str):
    buf = b""
    (fmt1, elem_size, np_type) = elem_format(ptype)

    while True:
        chunk = conn.recv(4096)
        if not chunk:
            raise ConnectionError("客户端断开连接")
        buf += chunk

        while True:
            si = find_start(buf)
            if si < 0:
                buf = b""
                break
            if si > 0:
                buf = buf[si:]

            if len(buf) < 5 + 4:
                break

            packet_len = struct.unpack(">I", buf[5:9])[0]
            total_len = 5 + packet_len

            if len(buf) < total_len:
                break

            frame = buf[:total_len]
            buf = buf[total_len:]

            if not frame.endswith(END):
                print("帧错误：缺少 END，尝试重新同步...")
                continue

            action = struct.unpack(">I", frame[9:13])[0]
            payload_bytes = frame[13:-3]

            if len(payload_bytes) % elem_size != 0:
                print(f"payload 长度错误：{len(payload_bytes)} 字节")
                continue

            payload = np.frombuffer(payload_bytes, dtype=np_type)
            yield action, payload, ptype

def find_start(buffer: bytes) -> int:
    # 返回 START 在 buffer 中的索引；找不到返回 -1
    return buffer.find(START)

def periodic_sender(conn: socket.socket, ptype: str, stop_event: threading.Event):
    # 连接建立后每 5 秒发送
    time.sleep(1)  # 等待客户端准备好
    action = 100  # 你可以自行定义 action；这里固定为 100
    while not stop_event.is_set():
        payload = make_test_signal(ptype)
        frame = build_frame(action, payload, ptype)
        try:
            conn.sendall(frame)
            print(f"[发送] action={action}，payload长度={len(payload)}，类型={ptype}")
        except OSError:
            break

        # 等待 5 秒，支持提前退出
        stop_event.wait(5.0)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=9000)
    ap.add_argument("--ptype", choices=["double", "uint32", "int32"], default="double")
    args = ap.parse_args()

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((args.host, args.port))
        s.listen(1)
        print(f"监听 {args.host}:{args.port}，payload类型={args.ptype}")

        conn, addr = s.accept()
        with conn:
            print("客户端已连接：", addr)

            stop_event = threading.Event()
            t = threading.Thread(target=periodic_sender, args=(conn, args.ptype, stop_event), daemon=True)
            t.start()

            try:
                for action, payload, ptype in parse_frames_stream(conn, args.ptype):
                    print(f"[收到] action={action}，payload长度={len(payload)}，类型={ptype}，前几个元素：{', '.join(map(str, payload[:10]))}...")
            except (ConnectionError, OSError) as e:
                print("连接结束：", e)
            finally:
                stop_event.set()
                t.join(timeout=1.0)

if __name__ == "__main__":
    main()
