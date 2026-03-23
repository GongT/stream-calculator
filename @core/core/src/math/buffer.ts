import type { TypeArray } from '@core/protocol';

export function concatTypedArrays<T extends TypeArray.Any>(arrays: T[]): T {
	const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
	const result = new (arrays[0].constructor as { new (length: number): T })(totalLength);

	let offset = 0;
	for (const arr of arrays) {
		if (arr.length === 0) continue;

		result.set(arr as any, offset);
		offset += arr.length;
	}

	return result;
}
