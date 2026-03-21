const bytesPerLine = 16;
const chunkBy = 8;

export function debugDumpBuffer(buffer: Buffer, prefix = '') {
	const lines = [];
	for (let i = 0; i < buffer.length; i += bytesPerLine) {
		const chunk = buffer.subarray(i, i + bytesPerLine);
		const hex = Array.from(chunk).map((byte) => byte.toString(16).padStart(2, '0'));
		const ascii = Array.from(chunk).map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'));

		insertSpaces(hex, chunkBy);
		insertSpaces(ascii, chunkBy);

		lines.push(`${prefix}${i.toString(16).padStart(8, '0')}: ${hex.join(' ').padEnd(bytesPerLine * 3 + 1)}     ${ascii.join('')}`);
	}

	console.error(lines.join('\n'));
}

function insertSpaces(array: string[], chunkSize: number) {
	const length = array.length + ((chunkSize - (array.length % chunkSize)) % chunkSize);

	for (let i = length - chunkSize; i > 0; i -= chunkSize) {
		array.splice(i, 0, ' ');
	}

	return array;
}
