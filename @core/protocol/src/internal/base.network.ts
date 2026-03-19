import assert from 'node:assert';
import type { INetworkEncode, IProtocol } from '../common/type.network.js';
import { getActionPayloadType } from './packet.decoupling.js';

const VERSION = 1;

const END_MARKER = Buffer.from('END', 'ascii');

export class NetworkPacket implements INetworkEncode, IProtocol {
	public readonly payload: INetworkEncode;

	constructor(
		public sender_agent: string = '',
		public sender_id: number = 0,
		public action: number = 0,
	) {
		const Class = getActionPayloadType(action);
		this.payload = new Class();

		const saBuff = Buffer.from(sender_agent, 'utf8');
		if (saBuff.length !== saBuff.byteLength) {
			throw new Error(`Sender agent string must be ASCII, but got non-ASCII characters`);
		}
		if (saBuff.length > 255) {
			throw new Error(`Sender agent string is too long, must be at most 255 bytes, but got ${saBuff.length} bytes`);
		}
		this.sender_agent = sender_agent;
	}

	payloadAs<T extends INetworkEncode>(Type: new () => T): T {
		if (!(this.payload instanceof Type)) {
			throw new Error(`载荷类型不匹配，期望 ${Type.name}，但实际为 ${this.payload.constructor.name}`);
		}
		return this.payload as T;
	}

	encode(): Buffer {
		const payload = this.payload.encode();
		const totalLength =
			4 + // frame_length
			1 + // version
			1 + // sender_agent_length
			this.sender_agent.length + // sender_agent
			4 + // sender_id
			4 + // action
			4 + // payload_length
			payload.byteLength +
			3; // END
		const r = Buffer.allocUnsafe(totalLength);
		let offset = 0;
		r.writeUInt32BE(totalLength, offset); // frame_length
		offset += 4;

		r.writeUInt8(VERSION, offset); // version
		offset += 1;

		r.writeUInt8(this.sender_agent.length, offset); // sender_agent_length
		offset += 1;

		const saBuff = Buffer.from(this.sender_agent, 'utf8');
		saBuff.copy(r, offset);
		offset += saBuff.length;

		r.writeUInt32BE(this.sender_id, offset); // sender_id
		offset += 4;

		r.writeUInt32BE(this.action, offset); // action
		offset += 4;

		r.writeUInt32BE(payload.byteLength, offset); // payload_length
		offset += 4;

		payload.copy(r, offset); // payload
		offset += payload.byteLength;

		END_MARKER.copy(r, offset);
		offset += END_MARKER.length;

		assert.equal(offset, totalLength, '编码长度计算错误');

		return r;
	}

	decode(data: Buffer): void {
		let offset = 0;
		const version = data.readUInt8(offset);
		offset += 1;
		if (version !== VERSION) {
			throw new Error(`Unsupported protocol version: ${version}`);
		}

		const sender_agent_length = data.readUInt8(offset);
		offset += 1;

		this.sender_agent = data.toString('ascii', offset, offset + sender_agent_length);
		offset += sender_agent_length;

		this.sender_id = data.readUInt32BE(offset);
		offset += 4;

		this.action = data.readUInt32BE(offset);
		offset += 4;

		const payload_length = data.readUInt32BE(offset);
		offset += 4;

		this.payload.decode(data.subarray(offset, offset + payload_length));
		offset += payload_length;

		const end = data.subarray(offset);
		if (end.compare(END_MARKER) !== 0) {
			throw new Error('Invalid packet: missing or invalid END marker');
		}

		assert.equal(offset + END_MARKER.length, data.length, '解码长度计算错误');
	}
}
