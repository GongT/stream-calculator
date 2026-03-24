import { connectTcp } from './connect.tcp.js';

export interface IConnectOptions {
	readonly address: string;
	readonly agentName: string;
	readonly agentId: number;
}
export interface ICreateOptions extends IConnectOptions {
	readonly type?: 'udp' | 'tcp';
}

export function createProtocolSocket({ type = 'tcp', ...options }: ICreateOptions) {
	if (type !== 'tcp') {
		throw new Error(`未实现: ${type}`);
	}
	return connectTcp(options);
}
