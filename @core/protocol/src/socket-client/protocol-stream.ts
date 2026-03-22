import { convertCaughtError, DeferredPromise, Emitter, EnhancedAsyncDisposable, prettyPrintError } from '@idlebox/common';
import { logger } from '@idlebox/logger';
import type { Socket as TCPSocket } from 'node:net';
import { debugDumpBuffer } from '../common/dump.js';
import type { IDataFrame, TypeArray } from '../common/type.base.js';
import { NetworkPacket } from '../networking/base.network.js';
import { Action } from '../networking/packet.decoupling.js';
import { DataPayload } from '../payloads/data-frame.payload.js';

// type ICommonSendFunction = (packet: Uint8Array, callback?: (err?: Error | null) => void) => void;

export class ProtocolStream extends EnhancedAsyncDisposable {
	private readonly _onNetworkPacket = this._register(new Emitter<NetworkPacket>());
	/**
	 * 除了keep-alive以外的所有数据包都会通过这个事件发出
	 */
	public readonly onNetworkPacket = this._onNetworkPacket.event;

	private buffer = Buffer.alloc(0);

	constructor(
		private readonly agent: string,
		private readonly agentId: number,
		protected readonly socket: TCPSocket,
	) {
		super(`protocol-socket`);

		this.handleData = this.handleData.bind(this);

		socket.on('data', this.handleData);

		socket.on('error', (err) => {
			logger.fatal`网络连接发生错误 ${err}`;
		});
	}

	private handleData(data: Buffer) {
		this.buffer = Buffer.concat([this.buffer, data]);
		const packetLength = this.buffer.readUInt32BE(0);
		if (this.buffer.length >= packetLength + 4) {
			const packetData = this.buffer.subarray(4, 4 + packetLength);
			// debugDumpBuffer(packetData, '<<< ');

			const packet = new NetworkPacket();
			try {
				packet.decode(packetData);
			} catch (e) {
				debugDumpBuffer(this.buffer.subarray(0, Math.max(4 + packetLength, 128)), '(E) ');
				const err = convertCaughtError(e);
				prettyPrintError('解析网络包出错', err);
				logger.fatal`解析网络包出错 ${err}`;
			}

			this.buffer = this.buffer.subarray(4 + packetLength);
			this.recv(packet);
		} else {
			logger.verbose`不完整数据包，当前长度: ${this.buffer.length}, 预期: ${packetLength + 4}`;
		}
	}

	private _ka?: DeferredPromise<void>;
	async sendKeepAlive() {
		if (this._ka) return this._ka.p;

		this._ka = new DeferredPromise<void>();
		const packet = new NetworkPacket(this.agent, this.agentId, Action.KEEP_ALIVE);
		await this.send(packet);

		return this._ka.p;
	}

	async sendDataFrame<T extends TypeArray.Any>(data: IDataFrame<T>, metadata?: any) {
		const payload = new DataPayload(data);

		const packet = new NetworkPacket(this.agent, this.agentId, payload);
		if (metadata !== undefined) {
			packet.metadata = metadata;
		}

		await this.send(packet);
	}

	private recv(data: NetworkPacket) {
		switch (data.action) {
			case Action.KEEP_ALIVE:
				{
					const packet = new NetworkPacket(this.agent, this.agentId, Action.KEEP_ALIVE_RESPONSE);
					this.send(packet).catch((err) => {
						logger.error`发送KeepAlive响应失败 ${err}`;
					});
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
					this._onNetworkPacket.fire(data);
				}
				break;
			default:
				throw new Error(`Unknown action: ${data.action}`);
		}
	}

	private send(packet: NetworkPacket) {
		const encoded = packet.encode();
		// debugDumpBuffer(encoded, '>>> ');
		return new Promise<void>((resolve, reject) => {
			this.socket.write(encoded, (err) => {
				if (err) {
					logger.warn`发送数据包失败 ${err}`;
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
}
