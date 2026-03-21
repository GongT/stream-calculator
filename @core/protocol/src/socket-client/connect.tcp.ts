import { logger } from '@idlebox/logger';
import { connect } from 'node:net';
import { parseAddress } from './address.js';
import type { IConnectOptions } from './index.js';
import { ProtocolStream } from './protocol-stream.js';

/** @internal */
export async function connectTcp({ address, agentId, agentName }: IConnectOptions) {
	const [ip, port] = parseAddress(address);

	const socket = connect({
		host: ip,
		port: port,
		timeout: 3000,
	});

	logger.debug`正在连接TCP服务器 ${ip}:${port} ...`;
	await new Promise<void>((resolve, reject) => {
		socket.once('connect', () => {
			socket.removeListener('error', reject);
			resolve();
		});
		socket.once('error', reject);
	});
	logger.verbose`成功连接`;

	return new ProtocolStream(agentName, agentId, socket);
}
