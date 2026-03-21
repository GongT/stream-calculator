import { EnhancedAsyncDisposable } from '@idlebox/common';
import { createLogger } from '@idlebox/logger';
import { adapterHost } from '../adapter-helpers/adapter-host.js';
import { HttpApiHost } from '../http-api/http-api-host.js';
import type { IAppHost } from './activate.js';

export class AppHost extends EnhancedAsyncDisposable implements IAppHost {
	readonly api = new HttpApiHost();
	readonly adapters = adapterHost;

	readonly logger = createLogger('app');

	constructor() {
		super('AppHost');
	}

	async activate() {
		await this.adapters.activate();
		this.logger.debug`用户程序已激活`;
	}

	async start() {
		this.logger.debug`流程定义已加载`;

		const nodes = [];
		for (const node of this.adapters.nodes) {
			nodes.push(node);
		}
		await Promise.all(nodes.map((node) => node.__initialize()));

		this.logger.info`开始数据流处理，总共${nodes.length}个节点`;
		for (const node of nodes) {
			node.resume();
		}

		this.logger.debug`数据流处理中`;
	}
}
