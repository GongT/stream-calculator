import type { TimestampT } from '../common/type.base.js';
import type { INetworkEncode } from '../common/type.network.js';

export interface IKeepAlivePayload {
	/**
	 * 毫秒时间戳
	 */
	readonly timestamp: TimestampT;
}

export class KeepAlivePayload implements INetworkEncode, IKeepAlivePayload {
	public timestamp = Date.now();

	encode(): Buffer {
		const buffer = Buffer.allocUnsafe(8);
		buffer.writeBigUInt64BE(BigInt(this.timestamp), 0);
		return buffer;
	}

	decode(data: Buffer): void {
		this.timestamp = Number(data.readBigUInt64BE(0));
	}
}
