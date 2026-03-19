import type { Action } from '../internal/packet.decoupling.js';

export type TypeValue = 'u' | 's' | 'f';
export type BitDepthValue = 8 | 16 | 32 | 64;

export interface INetworkEncode {
	encode(): Buffer;
	decode(data: Buffer): void;
}

type ActionTypes = string | number | boolean | object | null;

export interface IProtocol<T extends ActionTypes = ActionTypes> {
	readonly action: Action;
	readonly payload: T;
}

const typetree = {
	u: {
		8: Uint8Array,
		16: Uint16Array,
		32: Uint32Array,
		64: BigUint64Array,
	},
	s: {
		8: Int8Array,
		16: Int16Array,
		32: Int32Array,
		64: BigInt64Array,
	},
	f: {
		8: null, // 没有8位的浮点数
		16: Float16Array, // 应该很常用，但matlab没有这个精度
		32: Float32Array, // matlab的single
		64: Float64Array, // matlab的double
	},
} as const;

export type SupportedTypedArray =
	| Uint8Array<ArrayBufferLike>
	| Uint16Array<ArrayBufferLike>
	| Uint32Array<ArrayBufferLike>
	| BigUint64Array<ArrayBufferLike>
	| Int8Array<ArrayBufferLike>
	| Int16Array<ArrayBufferLike>
	| Int32Array<ArrayBufferLike>
	| BigInt64Array<ArrayBufferLike>
	| Float16Array<ArrayBufferLike>
	| Float32Array<ArrayBufferLike>
	| Float64Array<ArrayBufferLike>;

export function getTypedConstructor<T extends TypeValue, B extends BitDepthValue>(type: T, bitDepth: B): NonNullable<(typeof typetree)[T][B]> {
	const Cls = typetree[type][bitDepth];
	if (!Cls) throw new Error(`不支持的类型/位深组合: ${type}/${bitDepth}`);
	return Cls;
}
