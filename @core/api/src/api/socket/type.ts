import type { WebSocket } from 'ws';

export type WebSocketHandler = (this: void, socket: WebSocket) => Promise<void>;

export interface IWebSocketEndpointOptions {
	[name: string]: WebSocketHandler;
}

/**
 * @internal
 */
export abstract class WebSocketEndpoint {
	abstract readonly name: string;

	/**
	 * 处理WebSocket连接
	 */
	abstract handle(socket: WebSocket): Promise<void>;
}
