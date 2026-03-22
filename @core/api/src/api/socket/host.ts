import { closableToDisposable } from '@idlebox/common';
import type { IMyLogger } from '@idlebox/logger';
import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { WebSocketHandler } from './type.js';

export type ManyWsHandler = ReadonlyMap<string, WebSocketHandler>;

export interface IWebSocketHost {
	// TODO
}

/**
 * @internal
 */
export class WebSocketHost implements IWebSocketHost {
	protected readonly server: WebSocketServer;

	constructor(
		private readonly logger: IMyLogger,
		http: Server,
		protected readonly handlers: ManyWsHandler,
	) {
		this.logger.verbose`创建WebSocket服务器`;

		const verifyClient: WebSocket.VerifyClientCallbackSync = (info) => {
			if (!info.req.url) return false;

			let pathname: string;
			try {
				const u = new URL(info.req.url);
				pathname = u.pathname;
				if (!pathname.startsWith('/ws/')) {
					this.logger.verbose`拒绝WebSocket连接: URL必须以/ws/开头 ${info.req.url}`;
					return false;
				}
				pathname = pathname.slice(4);
			} catch {
				this.logger.verbose`拒绝WebSocket连接: 无效的URL ${info.req.url}`;
				return false;
			}

			const handle = handlers.get(pathname);
			if (!handle) {
				this.logger.verbose`拒绝WebSocket连接: 未知路径 ${info.req.url}`;
				return false;
			}

			Object.assign(info.req, { pathname, handler: handle });

			return true;
		};

		const wss = new WebSocketServer({
			server: http,
			clientTracking: false,
			verifyClient: verifyClient,
		});

		wss.on('connection', async (ws, req) => {
			const handler = (req as any).handler as WebSocketHandler;
			if (!handler) {
				this.logger.error`WebSocket连接缺少处理函数: ${req.url}`;
				ws.close(1011, 'Internal Server Error');
				return;
			}

			try {
				await handler(ws);
			} catch (err) {
				this.logger.error`WebSocket连接处理失败: ${err}`;
				ws.close(1011, 'Internal Server Error');
			}
		});

		this.server = wss;
	}

	dispose() {
		return closableToDisposable(this.server).dispose();
	}
}
