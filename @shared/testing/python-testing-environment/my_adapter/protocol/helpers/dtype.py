from typing import Literal

import numpy

DataType = Literal[b"u"] | Literal[b"s"] | Literal[b"f"]
BitDepth = Literal[8] | Literal[16] | Literal[32] | Literal[64]


def get_dtype(type: DataType, bit_depth: BitDepth):
    return numpy.dtype(get_element_type(type, bit_depth))


def get_element_type(type_t: DataType, bit_depth: BitDepth):
    if type(type_t) is str:
        type_t = bytes(type_t, "ascii")

    if type_t == b"u":
        if bit_depth == 8:
            return numpy.uint8
        elif bit_depth == 16:
            return numpy.uint16
        elif bit_depth == 32:
            return numpy.uint32
        elif bit_depth == 64:
            return numpy.uint64
    elif type_t == b"s":
        if bit_depth == 8:
            return numpy.int8
        elif bit_depth == 16:
            return numpy.int16
        elif bit_depth == 32:
            return numpy.int32
        elif bit_depth == 64:
            return numpy.int64
    elif type_t == b"f":
        if bit_depth == 16:
            return numpy.float16
        elif bit_depth == 32:
            return numpy.float32
        elif bit_depth == 64:
            return numpy.float64

    raise ValueError(f"不支持的数据类型: type={type_t}, bit_depth={bit_depth}")


def get_pack_format_from_dtype(dtype: numpy.dtype) -> str:
    match dtype.type:
        case numpy.uint8:
            return "B"
        case numpy.uint16:
            return "H"
        case numpy.uint32:
            return "I"
        case numpy.uint64:
            return "Q"
        case numpy.int8:
            return "b"
        case numpy.int16:
            return "h"
        case numpy.int32:
            return "i"
        case numpy.int64:
            return "q"
        case numpy.float16:
            return "e"
        case numpy.float32:
            return "f"
        case numpy.float64:
            return "d"

    raise ValueError(f"不支持的数据类型: {dtype}")
