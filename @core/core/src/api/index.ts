import { closableToDisposable, definePublicConstant, EnhancedAsyncDisposable, SoftwareDefectError } from '@idlebox/common';
import type { IMyLogger } from '@idlebox/logger';
import { existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { WebSocketServer } from 'ws';
import { HttpApiEndpoint, type IHttpApiEndpointOptions } from './http/api-endpoint.js';
import { createExpress, createStatic } from './http/create-app.js';
import { HttpRawApiEndpoint, type IHttpRawApiEndpointOptions } from './http/raw-endpoint.js';
import { createWebsocketServer } from './socket/create-wss.js';
import type { WebSocketEndpoint } from './socket/type.js';

export interface IApiHost {
	/**
	 * 普通Api
	 */
	provideJsonApi<IN, OUT>(options: IHttpApiEndpointOptions<IN, OUT>): void;

	/**
	 * 底层HTTP接口，直接操作响应，例如下载文件等
	 */
	provideRaw(handler: IHttpRawApiEndpointOptions): void;
	provideWebsocket(instance: WebSocketEndpoint): void;

	/**
	 * serve-file接口
	 */
	provideWebsite(path: string, dir: string): void;

	start(): void;

	/**
	 * @internal
	 */
	readonly wssLogger: IMyLogger;
}

const startingSlash = /^\/+/;

/**
 * API宿主
 *
 * http、websocket相关功能
 *
 * @internal
 */
export class ApiHost extends EnhancedAsyncDisposable implements IApiHost {
	public declare readonly wss: WebSocketServer;
	readonly wssLogger;
	public readonly listenTo: string | number;

	constructor(private readonly logger: IMyLogger) {
		super('ApiHost');
		this.wssLogger = this.logger.extend('wss');

		const port_or_path = process.env.HTTP_LISTEN || '38083';
		const port = Number.parseInt(port_or_path, 10);
		this.listenTo = Number.isNaN(port) ? port_or_path : port;
	}

	private readonly serveFiles = new Map<string, string>();
	provideWebsite(path: string, dir: string): void {
		if (!path.startsWith('/')) path = `/${path}`;

		if (!path.endsWith('/')) path += '/';

		if (path.startsWith('/api/')) throw new SoftwareDefectError(`页面路径不能以/api/开头: ${path}`);
		if (path.startsWith('/ws/')) throw new SoftwareDefectError(`页面路径不能以/ws/开头: ${path}`);
		if (this.serveFiles.has(path)) throw new SoftwareDefectError(`重复注册页面路径: ${path}`);

		if (!existsSync(dir)) throw new SoftwareDefectError(`提供的页面路径不存在: ${dir}`);
		if (!statSync(dir).isDirectory()) throw new SoftwareDefectError(`提供的页面路径不是目录: ${dir}`);

		this.serveFiles.set(path, dir);
	}

	private readonly jsonEndpoints = new Map<string, HttpApiEndpoint<any, any>>();
	provideJsonApi(options: IHttpApiEndpointOptions<any, any>): void {
		const instance = new HttpApiEndpoint(
			{
				...options,
				path: options.path.replace(startingSlash, ''),
			},
			this.logger,
		);
		this.logger.debug`注册JSON接口类: ${instance.displayName}`;
		if (this.jsonEndpoints.has(instance.displayName)) throw new SoftwareDefectError(`重复注册JSON接口: ${instance.displayName}`);
		if (this.rawEndpoints.has(instance.displayName)) throw new SoftwareDefectError(`重复注册JSON接口（已经注册为Raw接口）: ${instance.displayName}`);

		this.jsonEndpoints.set(instance.displayName, instance);
	}

	private readonly rawEndpoints = new Map<string, HttpRawApiEndpoint>();
	provideRaw(options: IHttpRawApiEndpointOptions): void {
		const instance = new HttpRawApiEndpoint(options, this.logger);
		this.logger.debug`注册Raw接口类: ${instance.displayName}`;
		const key = instance.displayName;
		if (this.jsonEndpoints.has(instance.displayName)) throw new SoftwareDefectError(`重复注册接口（已经注册为JSON接口）: ${key}`);
		if (this.rawEndpoints.has(key)) throw new SoftwareDefectError(`重复注册Raw接口: ${key}`);

		this.rawEndpoints.set(key, instance);
	}

	private readonly websocketEndpoints = new Map<string, WebSocketEndpoint>();
	provideWebsocket(instance: WebSocketEndpoint): void {
		const id = `${instance.name}:${instance.path}`;
		this.logger.debug`注册WebSocket接口类: ${id}`;
		if (this.websocketEndpoints.has(id)) {
			throw new SoftwareDefectError(`重复注册WebSocket接口: ${id}`);
		}
		this.websocketEndpoints.set(id, instance);
	}

	private started = false;
	async start() {
		if (this.started) {
			throw new SoftwareDefectError('重复启动API服务');
		}
		this.started = true;

		if (this.jsonEndpoints.size === 0 && this.rawEndpoints.size === 0 && this.websocketEndpoints.size === 0) {
			return this.useless();
		}
		Object.freeze(this.jsonEndpoints);
		Object.freeze(this.rawEndpoints);
		Object.freeze(this.websocketEndpoints);

		const server = createServer();

		if (this.jsonEndpoints.size || this.rawEndpoints.size || this.serveFiles.size) {
			this.startHttp(server);
		}
		if (this.websocketEndpoints.size) {
			await this.startWebsocket(server);
		}

		server.listen(this.listenTo, () => {
			this._register(closableToDisposable(server));
			this.logger.info`HTTP服务已启动，监听 http://0.0.0.0:${this.listenTo}`;
		});
	}

	private startHttp(server: Server) {
		createExpress((app, api) => {
			for (const handler of this.jsonEndpoints.values()) {
				this.logger.debug`JSON接口: ${handler.path}`;
				api.post(handler.path, handler.getHandle(), handler.getErrorHandler());
			}
			for (const handler of this.rawEndpoints.values()) {
				this.logger.debug`HTTP接口: ${handler.METHOD} ${handler.path}`;
				api[handler.method](handler.path, handler.getHandle(), handler.getErrorHandler());
			}
			for (const [path, dir] of this.serveFiles) {
				this.logger.debug`静态资源接口: ${path} -> ${dir}`;
				app.use(path, ...createStatic(dir, path === '/'));
			}

			server.on('request', app);
		});
	}

	private async startWebsocket(server: Server) {
		const wss = createWebsocketServer(server, this.wssLogger);

		await Promise.all(this.websocketEndpoints.values().map((instance) => instance.initialize()));

		for (const endpoint of this.websocketEndpoints.values()) {
			wss.add(endpoint);
		}

		this._register(wss);
		definePublicConstant(this, 'wss', wss);
	}

	private useless() {
		this.logger.info`当前程序没有提供HTTP或websocket接口，HTTP服务未启动`;
		this.dispose();
	}
}
