import assert from 'node:assert';
import type { INetworkEncode, INetworkPayload, IProtocol } from '../common/type.network.js';
import { getActionPayloadType, type Action } from './packet.decoupling.js';

const VERSION = 1;

const END_MARKER = Buffer.from('END', 'ascii');
const START_MARKER = Buffer.from('START', 'ascii');

export class NetworkPacket implements INetworkEncode, IProtocol {
	private _payload!: INetworkPayload;

	constructor(
		public sender_agent: string = '',
		public sender_id: number = 0,
		action_or_payload?: INetworkPayload | Action,
	) {
		if (typeof action_or_payload === 'number') {
			const Class = getActionPayloadType(action_or_payload);
			this._payload = new Class();
		} else if (action_or_payload) {
			this._payload = action_or_payload;
		}

		const saBuff = Buffer.from(sender_agent, 'utf8');
		if (saBuff.length !== saBuff.byteLength) {
			throw new Error(`Sender agent string must be ASCII, but got non-ASCII characters`);
		}
		if (saBuff.length > 255) {
			throw new Error(`Sender agent string is too long, must be at most 255 bytes, but got ${saBuff.length} bytes`);
		}
		this.sender_agent = sender_agent;
	}

	public get payload(): INetworkEncode {
		return this._payload;
	}

	public get action(): Action {
		return this._payload.kind;
	}

	payloadAs<T extends INetworkEncode>(Type: new () => T): T {
		if (!(this._payload instanceof Type)) {
			throw new Error(`载荷类型不匹配，期望 ${Type.name}，但实际为 ${this._payload.constructor.name}`);
		}
		return this._payload as T;
	}

	replacePayload(payload: INetworkPayload): void {
		this._payload = payload;
	}

	encode(): Buffer {
		const payload = this._payload.encode();
		const totalLength =
			4 + // frame_length 自身
			5 + // START
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
		r.writeUInt32BE(totalLength - 4, offset); // frame_length 不包含自身的长度
		offset += 4;

		START_MARKER.copy(r, offset); // START
		offset += START_MARKER.length;

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

		END_MARKER.copy(r, offset); // END
		offset += END_MARKER.length;

		assert.equal(offset, totalLength, '编码长度计算错误');

		return r;
	}

	decode(data: Buffer): void {
		let offset = 0;

		const start = data.subarray(offset, offset + START_MARKER.length);
		if (start.compare(START_MARKER) !== 0) {
			throw new Error('Invalid packet: missing or invalid START marker');
		}
		offset += START_MARKER.length;

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

		const action = data.readUInt32BE(offset);
		offset += 4;

		const payload_length = data.readUInt32BE(offset);
		offset += 4;

		if (this._payload?.kind !== action) {
			const Class = getActionPayloadType(action);
			this._payload = new Class();
		}
		this._payload.decode(data.subarray(offset, offset + payload_length));
		offset += payload_length;

		const end = data.subarray(offset);
		if (end.compare(END_MARKER) !== 0) {
			throw new Error('Invalid packet: missing or invalid END marker');
		}
		offset += END_MARKER.length;

		assert.equal(offset, data.length, '解码长度计算错误');
	}
}
