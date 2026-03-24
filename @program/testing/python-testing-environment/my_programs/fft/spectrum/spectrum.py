import numpy as np
from numpy.typing import NDArray
from scipy import fft


def compute_frequency_spectrum(
    signal: NDArray,
    sampling_rate: int,
    magnitude_scale: float = 10.0,
    phase_scale: float = 1000.0,
) -> dict:
    """
    计算信号的频域数据，返回前端可绘制的数据

    参数:
        signal: 时域信号数组 (一维 numpy int32 array)
        sampling_rate: 采样率 (Hz)
        magnitude_scale: 幅值缩放因子，默认放大10倍
        phase_scale: 相位缩放因子，默认放大1000倍

    返回:
        dict: 包含频率和幅度数据的字典，可直接发送给前端
    """
    n = len(signal)

    # 计算实数快速傅里叶变换 (RFFT)
    fft_result = fft.rfft(signal)

    # 计算幅度谱并应用缩放
    magnitudes: NDArray[np.float64] = np.abs(fft_result) * magnitude_scale

    # 计算相位谱
    phases: NDArray[np.float64] = np.angle(fft_result)

    # 将幅度转换为int32数组
    magnitudes_int32 = np.array(magnitudes, dtype=np.int32)

    # 将相位转换为int32数组（相位通常在-pi到pi之间，可能需要缩放）
    phases_scaled = phases * phase_scale  # 缩放相位值以便转换为int32
    phases_int32 = np.array(phases_scaled, dtype=np.int32)

    # 生成对应的频率轴
    frequencies = fft.rfftfreq(n, d=1.0 / sampling_rate)

    # 计算频率起始值和步长
    freq_start = float(frequencies[0]) if len(frequencies) > 0 else 0.0
    freq_step = (
        float(frequencies[1] - frequencies[0])
        if len(frequencies) > 1
        else (sampling_rate / n if n > 0 else 0.0)
    )

    return {
        "freq_start": freq_start,
        "freq_step": freq_step,
        "magnitudes": magnitudes_int32,
        "phases": phases_int32,
    }
