import numpy as np


def add_method(arrays: list[np.ndarray]) -> np.ndarray:
    max_length = max(arr.shape[0] for arr in arrays)
    result = np.zeros(max_length, dtype=arrays[0].dtype)
    for arr in arrays:
        result[: arr.shape[0]] += arr
    return result
