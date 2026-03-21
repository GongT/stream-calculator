import { logger } from '@idlebox/logger';
import { createSocket } from 'node:dgram';
import { parseAddress } from './address.js';
import type { IConnectOptions } from './index.js';
import { ProtocolStream } from './protocol-stream.js';

/** @internal */
export async function connectUdp({ address, agentId, agentName }: IConnectOptions) {
	const [ip, port, family] = parseAddress(address);

	const socket = createSocket({
		type: `udp${family}`,
		ipv6Only: false,
	});

	logger.debug`连接UDP服务器 ${ip}:${port} ...`;
	await new Promise<void>((resolve, reject) => {
		socket.once('error', reject);
		socket.connect(port, ip, () => {
			console.log('UDP socket connected');
			socket.removeListener('error', reject);
			resolve();
		});
	});
	logger.verbose`成功连接`;

	const r = new ProtocolStream(agentName, agentId, socket);

	await r.sendKeepAlive();

	return r;
}
