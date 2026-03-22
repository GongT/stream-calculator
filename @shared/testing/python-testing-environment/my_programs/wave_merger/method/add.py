import numpy as np


def add_method(arrays: list[np.ndarray]) -> np.ndarray:
    return np.sum(arrays, axis=0)
