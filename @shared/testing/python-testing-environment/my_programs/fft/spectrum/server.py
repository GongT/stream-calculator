import sys

from my_adapter import AbstractPayload, DataFramePayload, ProtocolServer

from .spectrum import compute_frequency_spectrum


async def main():
    server = ProtocolServer("fft", 0)

    async def handle_request(payload: AbstractPayload):
        data = payload.as_type(DataFramePayload)

        fft_result = compute_frequency_spectrum(data.content, data.rate)

        # debug_output(f"Received signal: {signal}")
        # debug_output(f"FFT result: {fft_result}")

        response = DataFramePayload(content=fft_result)
        await server.send(response)

    server.on_data_received(handle_request)

    await server.start()
    print(str(server.port), flush=True)
    print("FFT server is running...", file=sys.stderr, flush=True)

    await server.join()


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
