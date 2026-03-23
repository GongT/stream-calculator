import type { TimestampT } from '../common/type.base.js';
import type { INetworkPayload } from '../common/type.network.js';
import { Action, Payload } from '../networking/packet.decoupling.js';

export interface IKeepAlivePayload {
	/**
	 * 微秒时间戳
	 */
	readonly timestamp: TimestampT;
}

abstract class KeepAlivePayloadBase implements INetworkPayload, IKeepAlivePayload {
	abstract readonly kind: Action;

	constructor(public timestamp: TimestampT = Number(process.hrtime.bigint() / 1000n)) {}

	encode(): Buffer {
		const buffer = Buffer.allocUnsafe(8);
		buffer.writeBigUInt64BE(BigInt(this.timestamp), 0);
		return buffer;
	}

	decode(data: Buffer): void {
		this.timestamp = Number(data.readBigUInt64BE(0));
	}
}

export class KeepAlivePayload extends KeepAlivePayloadBase {
	override readonly kind = Action.KEEP_ALIVE;
}

Payload(KeepAlivePayload);

export class KeepAliveResponsePayload extends KeepAlivePayloadBase {
	override readonly kind = Action.KEEP_ALIVE_RESPONSE;
}

Payload(KeepAliveResponsePayload);
