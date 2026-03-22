import time
from collections import defaultdict, deque

from my_adapter.protocol.payloads.frame import DataFramePayload


class DataCollect:
    def __init__(self, size: int, buffer_length: int):
        self.size = size
        self.buffer_length = buffer_length
        self.data_store = defaultdict(
            deque
        )  # Stores packets grouped by timestamp in order of arrival
        self.last_received = {}  # Tracks the last received time for each timestamp

    def add_data(self, data: DataFramePayload) -> None | list[DataFramePayload]:
        timestamp = data.timestamp
        current_time = time.time() * 1000  # Current time in milliseconds

        # Discard packets that are already outdated
        if timestamp < current_time - self.buffer_length:
            return

        # Add the packet to the corresponding timestamp group
        self.data_store[timestamp].append(data)
        self.last_received[timestamp] = current_time

        # Check if all packets for the timestamp are received
        if len(self.data_store[timestamp]) == self.size:
            # Sort packets based on the 'function' field
            sorted_packets = sorted(
                self.data_store[timestamp], key=lambda x: x.function
            )
            del self.data_store[timestamp]  # Remove completed group
            del self.last_received[timestamp]
            return sorted_packets

    def garbage_collect(self):
        current_time = time.time() * 1000  # Current time in milliseconds
        expired_timestamps = [
            ts
            for ts, last_time in self.last_received.items()
            if last_time < current_time - self.buffer_length
        ]

        # Remove expired timestamps and their data
        for ts in expired_timestamps:
            del self.data_store[ts]
            del self.last_received[ts]
