export interface Constructor<T extends Any = Any> {
	new (...args: any[]): T;
}

export type U8 = Uint8Array<ArrayBuffer>;
export const U8: Constructor<U8> = Uint8Array<ArrayBuffer>;

export type U16 = Uint16Array<ArrayBuffer>;
export const U16: Constructor<U16> = Uint16Array<ArrayBuffer>;

export type U32 = Uint32Array<ArrayBuffer>;
export const U32: Constructor<U32> = Uint32Array<ArrayBuffer>;

export type U64 = BigUint64Array<ArrayBuffer>;
export const U64: Constructor<U64> = BigUint64Array<ArrayBuffer>;

export type S8 = Int8Array<ArrayBuffer>;
export const S8: Constructor<S8> = Int8Array<ArrayBuffer>;

export type S16 = Int16Array<ArrayBuffer>;
export const S16: Constructor<S16> = Int16Array<ArrayBuffer>;

export type S32 = Int32Array<ArrayBuffer>;
export const S32: Constructor<S32> = Int32Array<ArrayBuffer>;

export type S64 = BigInt64Array<ArrayBuffer>;
export const S64: Constructor<S64> = BigInt64Array<ArrayBuffer>;

export type F16 = Float16Array<ArrayBuffer>;
export const F16: Constructor<F16> = Float16Array<ArrayBuffer>;

export type F32 = Float32Array<ArrayBuffer>;
export const F32: Constructor<F32> = Float32Array<ArrayBuffer>;

export type F64 = Float64Array<ArrayBuffer>;
export const F64: Constructor<F64> = Float64Array<ArrayBuffer>;

export type Any = U8 | U16 | U32 | U64 | S8 | S16 | S32 | S64 | F16 | F32 | F64;

export type C = (new (size: number) => Any) & { BYTES_PER_ELEMENT: number };
