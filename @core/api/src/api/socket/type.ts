import { EnhancedAsyncDisposable } from '@idlebox/common';
import type { IMyLogger } from '@idlebox/logger';
import type { WebSocket } from 'ws';

export interface IWebSocketEndpointOptions {
	[name: string]: WebSocketEndpoint;
}

export abstract class WebSocketEndpoint extends EnhancedAsyncDisposable {
	protected readonly logger;
	constructor(
		public readonly name: string,
		logger: IMyLogger,
	) {
		super(`api:ws:${name}`);

		this.logger = logger.extend(name);
	}

	/**
	 * 处理WebSocket连接
	 */
	abstract connection(socket: WebSocket): Promise<void> | void;
}
