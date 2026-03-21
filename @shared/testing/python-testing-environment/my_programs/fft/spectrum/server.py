import sys
from importlib import metadata

import numpy as np

from my_adapter import AbstractPayload, DataFramePayload, ProtocolServer

from .spectrum import compute_frequency_spectrum


async def main(magnitude_scale: float = 10.0, phase_scale: float = 1000.0):
    server = ProtocolServer("fft", 0)

    async def handle_request(payload: AbstractPayload, metadata: dict | None):
        data = payload.as_type(DataFramePayload)

        fft_result = compute_frequency_spectrum(
            data.content, data.rate, magnitude_scale, phase_scale
        )

        meta = {
            "freq_start": fft_result["freq_start"],
            "freq_step": fft_result["freq_step"],
        }
        await server.send(
            DataFramePayload(
                content=fft_result["magnitudes"],
                function=1,
                timestamp=data.timestamp,
                rate=data.rate,
            ),
            metadata=meta,
        )
        await server.send(
            DataFramePayload(
                content=fft_result["phases"],
                function=2,
                timestamp=data.timestamp,
                rate=data.rate,
            ),
            metadata=meta,
        )

    server.on_data_received(handle_request)

    await server.start()
    print(str(server.port), flush=True)
    print("FFT server is running...", file=sys.stderr, flush=True)

    await server.join()


if __name__ == "__main__":
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="FFT Server")
    parser.add_argument(
        "--magnitude-scale",
        type=float,
        default=10.0,
        help="Scale factor for magnitude values in the FFT result",
    )
    parser.add_argument(
        "--phase-scale",
        type=float,
        default=1000.0,
        help="Scale factor for phase values in the FFT result",
    )
    args = parser.parse_args()

    asyncio.run(main(args.magnitude_scale, args.phase_scale))
