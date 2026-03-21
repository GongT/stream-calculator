import { connectTcp } from './connect.tcp.js';
import { connectUdp } from './connect.udp.js';

export interface IConnectOptions {
	readonly address: string;
	readonly agentName: string;
	readonly agentId: number;
}
interface ICreateOptions extends IConnectOptions {
	readonly type?: 'udp' | 'tcp';
}

export function createProtocolSocket({ type = 'tcp', ...options }: ICreateOptions) {
	if (type === 'udp') {
		return connectUdp(options);
	} else {
		return connectTcp(options);
	}
}
