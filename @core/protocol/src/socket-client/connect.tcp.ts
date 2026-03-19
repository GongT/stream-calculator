import { connect } from 'node:net';
import type { IConnectOptions } from './index.js';
import { ProtocolStream } from './protocol-stream.js';

/** @internal */
export async function connectTcp({ address, agentId, agentName }: IConnectOptions) {
	const url = new URL(`tcp://${address}`);

	const socket = connect({
		host: url.hostname,
		port: Number.parseInt(url.port, 10),
	});

	await new Promise<void>((resolve, reject) => {
		socket.once('connect', () => {
			socket.removeListener('error', reject);
			resolve();
		});
		socket.once('error', reject);
	});

	return new ProtocolStream(agentName, agentId, socket);
}
