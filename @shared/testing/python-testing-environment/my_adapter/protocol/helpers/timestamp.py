import time


def get_microseconds() -> int:
    return time.time_ns() // 1_000
