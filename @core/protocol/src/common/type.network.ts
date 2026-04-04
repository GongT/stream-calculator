import type { Action } from '../networking/packet.decoupling.js';
import type { IDataFrame, TypeArray } from './type.base.js';

export type TypeValue = 'u' | 's' | 'f';
export type BitDepthValue = 8 | 16 | 32 | 64;

export interface INetworkEncode {
	encode(): Buffer;

	/**
	 * 将网络包内容转换到自身变量
	 * 必须复制否则会造成内存错误
	 */
	decode(data: Buffer): void;
}

export interface INetworkPayload extends INetworkEncode {
	readonly kind: Action;
}
export interface INetworkPayloadConstructor {
	new (...args: any[]): INetworkPayload;
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

export function getTypedArrayClass<T extends TypeValue, B extends BitDepthValue>(type: T, bitDepth: B): NonNullable<(typeof typetree)[T][B]> {
	const Cls = typetree[type][bitDepth];
	if (!Cls) throw new Error(`不支持的类型/位深组合: ${type}/${bitDepth}`);
	return Cls;
}

const reverseSearch = new Map<TypeArray.Any, readonly [TypeValue, BitDepthValue]>();
for (const [type, bitDepths] of Object.entries(typetree)) {
	for (const [bitDepth, Cls] of Object.entries(bitDepths)) {
		if (Cls) {
			reverseSearch.set(Cls, [type as TypeValue, Number.parseInt(bitDepth, 10) as BitDepthValue]);
		}
	}
}
export function getTypeAndBitDepth(instance: TypeArray.Any): readonly [TypeValue, BitDepthValue] {
	const result = reverseSearch.get(instance.constructor as any);
	if (!result) {
		throw new Error(`不支持的类型数组: ${instance.constructor?.name ?? 'null'}`);
	}
	return result;
}

export function assertArrayType<T extends TypeArray.Any>(dataFrame: IDataFrame<TypeArray.Any>, Type: TypeArray.Constructor<T>): asserts dataFrame is IDataFrame<T> {
	if (dataFrame.content instanceof Type) {
		return;
	}
	throw new Error(`期望的数据类型为 ${Type.name}，但实际为 ${dataFrame.content.constructor.name}`);
}
