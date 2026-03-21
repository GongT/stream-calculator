import type { IDataFrame, TimestampT, TypeArray } from '../common/type.base.js';
import { getTypeAndBitDepth, getTypedArrayClass, type BitDepthValue, type INetworkPayload, type TypeValue } from '../common/type.network.js';
import { Action, Payload } from '../networking/packet.decoupling.js';
import { swapToLocalEndian, swapToNetworkEndian } from '../networking/swap-array.js';

export interface IDataPayload {
	readonly func: number;
	readonly timestamp: TimestampT;
	readonly type: TypeValue;
	readonly bit_depth: BitDepthValue;
	readonly rate: number;
	readonly content: Buffer;
}

const HEADER_MARKER = Buffer.from('DATA', 'ascii');

const emptyFrame: IDataFrame = {
	content: new Uint8Array(0),
	rate: 0,
	timestamp: 0,
	functionNumber: 0,
};

/**
 * 
 */
export class DataPayload implements INetworkPayload, IDataPayload {
	public func = 0;
	public type: TypeValue = 'u';
	public bit_depth: BitDepthValue = 32;
	public rate = 0;
	public timestamp = 0;
	public content = Buffer.alloc(0);

	public readonly kind = Action.DATA;

	constructor(buffer: IDataFrame = emptyFrame) {
		if (buffer) {
			const [type, bit_depth] = getTypeAndBitDepth(buffer.content);
			this.type = type;
			this.bit_depth = bit_depth;
			this.rate = buffer.rate;
			this.timestamp = buffer.timestamp;
			this.func = buffer.functionNumber ?? 0;
			if (buffer.content.length) {
				this.content = Buffer.from(buffer.content.buffer);
			}
		}
	}

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

		HEADER_MARKER.copy(header, offset);
		offset += 4;

		return Buffer.concat([header, swapToNetworkEndian(this.content, this.bit_depth)]);
	}

	decode(data: Buffer<ArrayBuffer>): void {
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

		const header = data.subarray(offset, offset + 4);
		offset += 4;
		if (Buffer.compare(header, HEADER_MARKER) !== 0) {
			throw new Error(`Invalid header: ${header} (expect ${HEADER_MARKER})`);
		}

		this.content = swapToLocalEndian(data.subarray(offset), this.bit_depth, true);
	}

	asTypedArray<T extends TypeArray.Any>(Type?: new (...args: any[]) => T): T {
		const Cls = getTypedArrayClass(this.type, this.bit_depth);
		if (Type && (Cls as any) !== Type) {
			throw new Error(`类型不匹配：数据包中的类型是 ${Cls.name}，但请求的类型是 ${Type.name}`);
		}
		return new Cls(this.content.buffer) as unknown as T;
	}
}

Payload(DataPayload);
