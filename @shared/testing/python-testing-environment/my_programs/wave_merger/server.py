import json
import sys
from importlib import metadata
from inspect import getargs

import numpy as np

from my_adapter import AbstractPayload, DataFramePayload, ProtocolServer
from my_adapter.protocol.helpers.dtype import BitDepth, DataType

from . import MergeMethod
from .data_collect import DataCollect
from .method.add import add_method


def check(arr: list[np.ndarray]):
    """
    检查所有元素的dtype和length是否一致
    """

    first_dtype = arr[0].dtype
    first_length = len(arr[0])

    for a in arr:
        if a.dtype != first_dtype or len(a) != first_length:
            return False

    return True


async def main(size: int, method: MergeMethod):
    server = ProtocolServer("merge", 0)

    collect = DataCollect(size)

    method_func = None
    if method == MergeMethod.ADD:
        method_func = add_method
    else:
        raise ValueError(f"Unsupported merge method: {method}")

    async def handle_request(payload: AbstractPayload, metadata: dict | None):
        data = payload.as_type(DataFramePayload)

        arr = collect.add_data(data)
        if arr is None:
            return

        new_content = method_func([d.content for d in arr])

        await server.send(
            DataFramePayload(
                content=new_content,
                function=0,
                timestamp=data.timestamp,
                rate=data.rate,
            ),
        )

    server.on_data_received(handle_request)

    await server.start()
    print(str(server.port), flush=True)
    print("merge is running...", file=sys.stderr, flush=True)

    print(json.dumps({"type": "listen", "port": server.port}), flush=True)

    await server.join()


if __name__ == "__main__":
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="Merge Server")
    parser.add_argument(
        "--method",
        type=MergeMethod,
        choices=list(MergeMethod),
        help="数据处理方法",
    )
    parser.add_argument(
        "--size",
        type=int,
        help="数据组数",
    )
    args = parser.parse_args()

    asyncio.run(main(args.size, args.method))
