from datetime import datetime


def get_milliseconds(time=datetime.now()) -> int:
    return int(time.microsecond / 1000)
