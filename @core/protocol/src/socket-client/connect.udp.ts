import { createSocket } from 'node:dgram';
import type { IConnectOptions } from './index.js';
import { ProtocolStream } from './protocol-stream.js';

/** @internal */
export async function connectUdp({ address, agentId, agentName }: IConnectOptions) {
	const url = new URL(`udp://${address}`);
	const socket = createSocket({
		type: 'udp6',
		ipv6Only: false,
	});

	socket.connect(Number.parseInt(url.port, 10), url.hostname);

	const r = new ProtocolStream(agentName, agentId, socket);

	await r.keepAlive();

	return r;
}
