import type { INetworkEncode } from '../common/type.network.js';
import { DataPayload } from '../network-packets/data.payload.js';
import { KeepAlivePayload } from '../network-packets/keepalive.payload.js';

export enum Action {
	KEEP_ALIVE = 1,
	KEEP_ALIVE_RESPONSE = 2,
	DATA = 3,
}

export function getActionPayloadType(action: Action): new () => INetworkEncode {
	switch (action) {
		case Action.KEEP_ALIVE:
			return KeepAlivePayload;
		case Action.KEEP_ALIVE_RESPONSE:
			return KeepAlivePayload;
		case Action.DATA:
			return DataPayload;
		default:
			throw new Error(`Unknown action: ${action}`);
	}
}
