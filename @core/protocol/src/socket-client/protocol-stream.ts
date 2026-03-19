import { convertCaughtError, DeferredPromise, Emitter, EnhancedAsyncDisposable, prettyPrintError } from '@idlebox/common';
import { logger } from '@idlebox/logger';
import type { Socket as UDPSocket } from 'node:dgram';
import type { Socket as TCPSocket } from 'node:net';
import type { IDataFrame } from '../common/type.base.js';
import { getPayloadFrameFromNetwork } from '../common/type.helper.js';
import { NetworkPacket } from '../internal/base.network.js';
import { Action } from '../internal/packet.decoupling.js';

export class ProtocolStream extends EnhancedAsyncDisposable {
	private readonly _onData = this._register(new Emitter<IDataFrame>());
	private buffer = Buffer.alloc(0);
	private readonly _raw_send: (packet: Uint8Array) => void;

	constructor(
		private readonly agent: string,
		private readonly agentId: number,
		protected readonly socket: TCPSocket | UDPSocket,
	) {
		super(`protocol-socket`);

		socket.on('data', (data: Buffer) => {
			this.buffer = Buffer.concat([this.buffer, data]);
			const packetLength = this.buffer.readUInt32BE(0);
			if (this.buffer.length >= packetLength + 4) {
				const packetData = this.buffer.subarray(4, 4 + packetLength);

				const packet = new NetworkPacket();
				try {
					packet.decode(packetData);
				} catch (e) {
					const err = convertCaughtError(e);
					prettyPrintError('解析网络包出错', err);
					logger.fatal`解析网络包出错 ${err}`;
				}

				this.buffer = this.buffer.subarray(4 + packetLength);
				this.recv(packet);
			}
		});

		socket.on('error', (err) => {
			logger.fatal`网络连接发生错误 ${err}`;
		});

		this._raw_send = getRawSendFunction(socket);
	}

	private _ka?: DeferredPromise<void>;
	keepAlive() {
		if (this._ka) return this._ka.p;

		this._ka = new DeferredPromise<void>();
		const packet = new NetworkPacket(this.agent, this.agentId, Action.KEEP_ALIVE);
		this.send(packet);

		return this._ka.p;
	}

	private recv(data: NetworkPacket) {
		switch (data.action) {
			case Action.KEEP_ALIVE:
				{
					const packet = new NetworkPacket(this.agent, this.agentId, Action.KEEP_ALIVE_RESPONSE);
					this.send(packet);
				}
				break;
			case Action.KEEP_ALIVE_RESPONSE:
				if (this._ka) {
					this._ka.complete();
					this._ka = undefined;
				}
				break;
			case Action.DATA:
				{
					const frame = getPayloadFrameFromNetwork(data);
					this._onData.fire(frame);
				}
				break;
			default:
				throw new Error(`Unknown action: ${data.action}`);
		}
	}

	private send(packet: NetworkPacket) {
		const encoded = packet.encode();
		this._raw_send(encoded);
	}
}
function getRawSendFunction(socket: TCPSocket | UDPSocket): (packet: Uint8Array) => void {
	if ('send' in socket) {
		return socket.send.bind(socket);
	} else {
		return socket.write.bind(socket);
	}
}
