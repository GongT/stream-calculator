import type { TimestampT } from '../common/type.base.js';
import { getTypedConstructor, type BitDepthValue, type INetworkEncode, type SupportedTypedArray, type TypeValue } from '../common/type.network.js';

export interface IDataPayload {
	readonly func: number;
	readonly timestamp: TimestampT;
	readonly type: TypeValue;
	readonly bit_depth: BitDepthValue;
	readonly rate: number;
	readonly content: Buffer;
}

const HEADER_MARKER = Buffer.from('DATA', 'ascii').readUInt32BE(0);

/**
| 字段 | 类型/长度(字节) | 描述 |
| --- | --- | --- |
| function | uint32 | 功能码，表示具体的操作或命令，各程序自己定义，也可不用（设为0） |
| timestamp | uint64 | 时间戳，表示数据包所包含数据的**开始**时间，单位为**毫秒** |
| type | uint8 | 符号和类型，`'u'(0x75)` 表示无符号整数，`'s'(0x73)` 表示有符号整数，`'f'(0x66)` 表示有符号浮点数 |
| bit_depth | int8 | 位深（见下方） |
| rate | uint32 | 采样率，每**秒**点数 |
| header | uint8*4 | 固定为 `DATA`，用于验证逻辑 |
| array | ... | 数据内容 |
 */
export class DataPayload implements INetworkEncode, IDataPayload {
	public func = 0;
	public timestamp = 0;
	public type: TypeValue = 'u';
	public bit_depth: BitDepthValue = 32;
	public rate = 0;
	public content = Buffer.alloc(0);

	encode(): Buffer {
		const header = Buffer.allocUnsafe(4 + 8 + 1 + 1 + 4 + 4);
		let offset = 0;
		header.writeUInt32BE(this.func, offset);
		offset += 4;

		header.writeBigUInt64BE(BigInt(this.timestamp), offset);
		offset += 8;

		header.writeUInt8(this.type.charCodeAt(0), offset);
		offset += 1;

		header.writeInt8(this.bit_depth, offset);
		offset += 1;

		header.writeUInt32BE(this.rate, offset);
		offset += 4;

		header.writeUInt32BE(HEADER_MARKER, offset);
		offset += 4;

		return Buffer.concat([header, this.content]);
	}

	decode(data: Buffer): void {
		let offset = 0;
		this.func = data.readUInt32BE(offset);
		offset += 4;

		this.timestamp = Number(data.readBigInt64BE(offset));
		offset += 8;

		this.type = String.fromCharCode(data.readUInt8(offset)) as TypeValue;
		offset += 1;

		this.bit_depth = data.readInt8(offset) as BitDepthValue;
		offset += 1;

		this.rate = data.readUInt32BE(offset);
		offset += 4;

		const header = data.readUInt32BE(offset);
		offset += 4;
		if (header !== HEADER_MARKER) {
			throw new Error(`Invalid header: ${header.toString(16)} (expect ${HEADER_MARKER.toString(16)})`);
		}

		this.content = Buffer.copyBytesFrom(data, offset);
	}

	asTypedArray<T extends SupportedTypedArray>(Type?: new (...args: any[]) => T): T {
		const Cls = getTypedConstructor(this.type, this.bit_depth);
		if (Type && (Cls as any) !== Type) {
			throw new Error(`类型不匹配：数据包中的类型是 ${Cls.name}，但请求的类型是 ${Type.name}`);
		}
		return new Cls(this.content.buffer) as unknown as T;
	}
}
