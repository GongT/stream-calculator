import type { EventRegister, IAsyncDisposable } from '@idlebox/common';
import { definePublicConstant, EnhancedAsyncDisposable, LinuxErrorCode, registerGlobalLifecycle, sleep } from '@idlebox/common';
import { createLogger, type IMyLogger } from '@idlebox/logger';
import { registerNodejsGlobalErrorCodeHandler } from '@idlebox/node';
import { inspect } from 'node:util';
import { AdapterHost } from '../adapter-helpers/adapter-host.js';
import { ApiHost, type IApiHost } from '../api/index.js';

/**
 * 应用程序宿主
 * 各种适配器、API、数据流处理节点、数据处理模块的容器
 * 基本没有逻辑
 */
export interface IAppHost {
	/**
	 * 程序即将推出，在所有清理之前同步执行
	 */
	readonly onBeforeDispose: EventRegister<void>;

	/**
	 * 程序即将推出，在所有清理之后同步执行
	 */
	readonly onPostDispose: EventRegister<void>;

	/**
	 * 注册资源到全局，不建议直接使用
	 */
	_register(d: IAsyncDisposable): void;

	/**
	 * HTTP、websocket宿主
	 */
	readonly api: IApiHost;

	/**
	 * 适配器宿主
	 */
	readonly adapters: AdapterHost;

	/**
	 * 日志
	 */
	readonly logger: IMyLogger;

	printStatus(): void;
}

class AppHost extends EnhancedAsyncDisposable implements IAppHost {
	readonly logger = createLogger('app');

	readonly api = this._register(new ApiHost(this.logger.extend('api')), true);
	readonly adapters = this._register(new AdapterHost(this.logger.extend('adapter')));

	constructor() {
		super('AppHost');
		registerGlobalLifecycle(this);
	}

	override async dispose() {
		registerNodejsGlobalErrorCodeHandler(LinuxErrorCode.EPIPE, () => {
			// ignore pipe error
		});

		this.logger.log`正在清理资源...`;
		await super.dispose();
		await sleep(50);
		this.logger.log`资源已清理完毕`;
	}

	printStatus() {
		let count = 0;
		for (const node of this.adapters.nodes) {
			console.error(`${inspect(node, { colors: true })}`);
			count++;
		}

		const l = this.api.listenTo;
		let h: string;
		if (typeof l === 'string') {
			h = `API监听在 ${l}`;
		} else {
			h = `HTTP: http://0.0.0.0:${l}`;
		}

		console.error(`节点数: ${count} | ${h}`);
		// TODO
	}
}

/**
 * 导出全局变量
 */
definePublicConstant(globalThis, 'application', new AppHost());
declare global {
	const application: IAppHost;
}
