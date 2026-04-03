import { EnhancedAsyncDisposable } from '@idlebox/common';
import type { WebSocket } from 'ws';

export interface IWebSocketEndpointOptions {
	[name: string]: WebSocketEndpoint;
}

export abstract class WebSocketEndpoint extends EnhancedAsyncDisposable {
	protected readonly logger;
	constructor(public readonly name: string) {
		super(`api:ws:${name}`);

		this.logger = application.api.wssLogger.extend(name);
	}

	/**
	 * @virtual
	 */
	async initialize(): Promise<void> {}

	/**
	 * 处理WebSocket连接
	 */
	abstract connection(socket: WebSocket): Promise<void> | void;
}
