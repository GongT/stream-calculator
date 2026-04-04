import type { IMyLogger } from '@idlebox/logger';
import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { WebSocketEndpoint } from './type.js';

export interface IWebSocketHost {
	add(handler: WebSocketEndpoint): void;
	dispose(): Promise<void>;
}

/**
 * @internal
 */
export function createWebsocketServer(httpServer: Server, logger: IMyLogger): IWebSocketHost {
	logger.debug`创建WebSocket服务器`;

	const handlers = new Map<string, WebSocketEndpoint>();

	const verifyClient: WebSocket.VerifyClientCallbackSync = (info) => {
		if (!info.req.url) return false;

		let pathname: string = info.req.url;
		if (!pathname.startsWith('/ws/')) {
			logger.warn`拒绝WebSocket连接: URL必须以/ws/开头 ${info.req.url}`;
			return false;
		}
		pathname = pathname.slice(4);

		const handle = handlers.get(pathname);
		if (!handle) {
			console.log(handlers);
			logger.warn`拒绝WebSocket连接: 未知路径 ${info.req.url}`;
			return false;
		}

		info.req.pathname = pathname;
		info.req.endpoint = handle;

		return true;
	};

	const wss = new WebSocketServer({
		server: httpServer,
		clientTracking: false,
		verifyClient: verifyClient,
	});

	wss.on('connection', async (socket, req) => {
		logger.debug`WebSocket连接已建立! ${req.url}`;
		const handler = req.endpoint;
		if (!handler) {
			logger.error`WebSocket连接缺少处理对象: ${req.url}`;
			socket.close(1011, 'Internal Server Error');
			return;
		}

		try {
			await handler.connection(socket);
		} catch (err) {
			logger.error`WebSocket连接处理失败: ${err}`;
			socket.close(1011, 'Internal Server Error');
		}
	});

	return {
		add(handler: WebSocketEndpoint) {
			handlers.set(handler.path, handler);
		},
		dispose() {
			return new Promise((resolve, reject) => {
				logger.log`关闭WebSocket服务器`;
				wss.close((err) => {
					if (err) {
						logger.warn`关闭WebSocket服务器失败: ${err.message}`;
						reject(err);
					} else {
						logger.debug`WebSocket服务器已关闭`;
						resolve();
					}
				});
			});
		},
	};
}
