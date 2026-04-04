import type { Writeable } from '@idlebox/common';
import type { TimestampT, TypeArray } from '../common/type.base.js';
import { getTypedArrayClass, type BitDepthValue, type TypeValue } from '../common/type.network.js';

export interface IDataPayloadBrowser {
	readonly func: number;
	readonly timestamp: TimestampT;
	readonly type: TypeValue;
	readonly bit_depth: BitDepthValue;
	readonly rate: number;
	readonly content: TypeArray.Any;
}
export function decodeBinaryFrame(buffer: Uint8Array<ArrayBuffer>): IDataPayloadBrowser {
	const dataPayload: Writeable<IDataPayloadBrowser> = {
		bit_depth: 8,
		func: 0,
		rate: 0,
		timestamp: 0,
		type: 'u',
		content: null as any,
	};
	const dataView = new DataView(buffer.buffer);
	let offset = 0;

	dataPayload.func = dataView.getUint32(offset, true);
	offset += 4;
	dataPayload.timestamp = Number(dataView.getBigUint64(offset, true));
	offset += 8;
	dataPayload.type = String.fromCharCode(dataView.getUint8(offset)) as TypeValue;
	offset += 1;
	dataPayload.bit_depth = dataView.getInt8(offset) as BitDepthValue;
	offset += 1;
	dataPayload.rate = dataView.getUint32(offset, true);
	offset += 4;

	const header = new Uint8Array(buffer.buffer, offset, 4);
	offset += 4;
	if (new TextDecoder().decode(header) !== 'DATA') {
		throw new Error(`Invalid header: ${header} (expect DATA)`);
	}

	const Class = getTypedArrayClass(dataPayload.type, dataPayload.bit_depth);
	const content = new Class(buffer.buffer.slice(offset));
	dataPayload.content = content;

	return dataPayload;
}
