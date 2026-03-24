import sys


def debug_output(*args):
    print(*args, file=sys.stderr, flush=True)


BYTES_PER_LINE = 16
CHUNK_BY = 8


def debug_dump_buffer(buff: bytes, prefix: str = ""):
    for i in range(0, len(buff), BYTES_PER_LINE):
        chunk = buff[i : i + BYTES_PER_LINE]
        hex_part = " ".join(f"{b:02x}" for b in chunk)
        ascii_part = "".join(chr(b) if 32 <= b <= 126 else "." for b in chunk)

        # Insert spaces every CHUNK_BY bytes
        hex_part = " ".join(
            hex_part[j : j + CHUNK_BY * 3]
            for j in range(0, len(hex_part), CHUNK_BY * 3)
        )
        ascii_part = " ".join(
            ascii_part[j : j + CHUNK_BY] for j in range(0, len(ascii_part), CHUNK_BY)
        )

        debug_output(f"{prefix}{i:08x}: {hex_part:<{BYTES_PER_LINE*3}} {ascii_part}")
