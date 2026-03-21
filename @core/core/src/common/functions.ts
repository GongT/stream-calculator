import type { Primitive } from '@idlebox/common';

export function instanceOf<T>(instance: any, Class: new (...args: any[]) => T): instance is T {
	return instance instanceof Class;
}

const idx = new Map<string, number>();
export function getSerialNumber(id: string) {
	const count = idx.get(id) ?? 0;
	idx.set(id, count + 1);
	return count;
}

export type Writeable<T> = T extends Primitive
	? T
	: T extends ReadonlyArray<infer U>
		? Array<U>
		: T extends ReadonlyMap<infer K, infer V>
			? Map<K, V>
			: T extends ReadonlySet<infer M>
				? Set<M>
				: { -readonly [K in keyof T]: T[K] };
