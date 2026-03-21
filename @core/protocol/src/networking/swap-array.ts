import type { BitDepthValue } from '../common/type.network.js';

/**
 * 默认运行在小端序系统上，如果数据包中的位深大于8，则需要进行字节交换
 * 理论上应该判断当前系统的字节序
 */
export function swapToLocalEndian(buffer: Buffer, size: BitDepthValue, forceCopy = false): Buffer<ArrayBuffer> {
	if (size === 8 && !forceCopy) {
		return buffer as unknown as Buffer<ArrayBuffer>;
	}

	const clone = Buffer.allocUnsafe(buffer.length);
	buffer.copy(clone);

	switch (size) {
		case 8:
			break;
		case 16:
			clone.swap16();
			break;
		case 32:
			clone.swap32();
			break;
		case 64:
			clone.swap64();
			break;
		default:
			throw new Error(`Unsupported bit depth: ${size}`);
	}
	return clone;
}

/**
 * 网络传输需要使用大端序，因此在发送前需要进行字节交换
 * 理论上应该判断当前系统的字节序
 */
export function swapToNetworkEndian(buffer: Buffer, size: BitDepthValue, forceCopy = false): Buffer<ArrayBuffer> {
	return swapToLocalEndian(buffer, size, forceCopy);
}
