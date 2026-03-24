from collections import deque

from my_adapter.protocol.payloads.frame import DataFramePayload


class DataCollect:
    def __init__(self, size: int):
        self.size = size
        self.buffers = {i: deque() for i in range(size)}

    def add_data(self, data: DataFramePayload):
        queue = self.buffers[data.function]
        queue.append(data)

        max_length = max(len(queue) for queue in self.buffers.values())
        return self.check_head(), max_length

    def check_head(self):
        for queue in self.buffers.values():
            if not queue:
                return None

        # 每个队列头部都有一个包，将他们按function（也就是buffers的key）排序后返回
        return [self.buffers[i].popleft() for i in sorted(self.buffers.keys())]
