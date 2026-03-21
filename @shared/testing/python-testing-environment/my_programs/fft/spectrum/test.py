import json
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

from .spectrum import compute_frequency_spectrum


def generate_test_signal(
    duration=1.0, sampling_rate=1000, volume=65535
) -> NDArray[np.int32]:
    """
    生成一个包含多频率成分的正弦波测试信号。

    参数:
        duration: 信号持续时间 (秒)
        sampling_rate: 采样率 (Hz)
        volume: 最大值振幅

    返回:
        NDArray[np.int32]: 生成的时域信号数组
    """
    t = np.linspace(0, duration, int(sampling_rate * duration), endpoint=False)

    # 生成两个频率成分：50Hz 和 120Hz
    freq1 = 50
    freq2 = 120

    signal = np.sin(2 * np.pi * freq1 * t) + 0.5 * np.sin(2 * np.pi * freq2 * t)

    # 归一化并应用到指定音量
    signal = signal / np.max(np.abs(signal)) * volume

    return signal.astype(np.int32)


def generate_test_noise(
    duration=1.0, sampling_rate=1000, volume=65535
) -> NDArray[np.int32]:
    """
    生成一个包含随机噪声的测试信号。

    参数:
        duration: 信号持续时间 (秒)
        sampling_rate: 采样率 (Hz)
        volume: 最大值振幅

    返回:
        NDArray[np.int32]: 生成的时域信号数组
    """
    num_samples = int(sampling_rate * duration)
    noise = np.random.normal(0, 1, num_samples)

    # 归一化并应用到指定音量
    noise = noise / np.max(np.abs(noise)) * volume

    return noise.astype(np.int32)


def test():
    sampling_rate = 1000

    signal = generate_test_noise(
        duration=1.0, sampling_rate=sampling_rate, volume=1000
    ) + generate_test_signal(duration=1.0, sampling_rate=sampling_rate, volume=1000)

    # 计算频域数据
    spectrum_data = compute_frequency_spectrum(signal, sampling_rate)

    serializable_data = {
        "freq_start": spectrum_data["freq_start"],
        "freq_step": spectrum_data["freq_step"],
        "magnitudes": spectrum_data["magnitudes"].tolist(),
        "phases": spectrum_data["phases"].tolist(),
    }

    # 输出结果
    print("Magnitudes:", len(serializable_data["magnitudes"]))
    print("Phases (radians):", len(serializable_data["phases"]))

    output = Path(__file__).parent.joinpath("www/data.json")

    serializable_data["signal"] = signal.tolist()
    serializable_data["sampling_rate"] = sampling_rate

    output.write_text(json.dumps(serializable_data, indent=4))


if __name__ == "__main__":
    test()
