import numpy as np
from scipy.signal import detrend
from scipy.fft import rfft, rfftfreq


def bandvalue_extraction(x, fs, freqrange):
    """
    Simplified band value extraction (MATLAB bandvalueExtraction 的 Python 版本)

    参数:
        x: ndarray, shape (N,) 或 (N, M)
           每一列是一条信号；若为一维，则视为单通道
        fs: float
           采样频率
        freqrange: (f_low, f_up)
           频带范围（Hz）

    返回:
        bandvalue: ndarray, shape (M,)
           每个通道一个带通特征值
    """
    x = np.asarray(x, dtype=float)
    if x.ndim == 1:
        x = x[:, None]  # 转成 (N, 1)

    if x.ndim != 2:
        raise ValueError("x 必须是 1D 或 2D 数组。")

    n = x.shape[0]
    f_low, f_up = float(freqrange[0]), float(freqrange[1])

    # MATLAB: abs(fft(detrend(x,0)))
    x_detrended = detrend(x, axis=0, type="constant")
    yfft = np.abs(rfft(x_detrended, axis=0)) / (n / 2.0)  # 对齐 MATLAB 的幅值缩放

    # 频率轴（推荐写法，通用于任意 n 和 fs）
    xfft = rfftfreq(n, d=1.0 / fs)

    # MATLAB 对应:
    # idx_start = find(xfft <= freqrange(1), 1, 'last');
    # idx_end   = find(xfft >= freqrange(2), 1, 'first');
    start_candidates = np.where(xfft <= f_low)[0]
    end_candidates = np.where(xfft >= f_up)[0]

    if start_candidates.size == 0 or end_candidates.size == 0:
        raise ValueError("freqrange 超出频谱范围，请检查 fs、n 和 freqrange。")

    idx_start = start_candidates[-1]
    idx_end = end_candidates[0]

    if idx_start > idx_end:
        raise ValueError("freqrange 无效：下限对应索引大于上限对应索引。")

    # MATLAB 端点是包含的，所以 Python 切片要 +1
    band_power = np.sum(yfft[idx_start:idx_end + 1, :] ** 2, axis=0)
    bandvalue = np.sqrt(band_power) / np.sqrt(2.0)

    return bandvalue
