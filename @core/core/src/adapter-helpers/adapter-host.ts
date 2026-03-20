import {
	convertCaughtError,
	EnhancedAsyncDisposable,
	getErrorFrame,
	globalSingletonStrong,
	prettyPrintError,
	registerGlobalLifecycle,
	SoftwareDefectError,
} from '@idlebox/common';
import { createLogger } from '@idlebox/logger';
import { reflectBinding } from '../package-reflect/binding.js';
import type { BaseNodeConstructor } from '../stream/node.base.js';
import { Adapter, type IBaseAdapterOptions } from './adapter.js';

type AdapterConstructor = new (options: IBaseAdapterOptions) => Adapter;

export interface INodeInfo {
	readonly adapter: Adapter;
	readonly constructorName: string;
	readonly package: {
		readonly name: string;
		readonly description: string;
		readonly version: string;
	};
}

const prefix = /\s*at\s+(.+\()?/;
const endingRowCol = /:\d+:\d+\)?$/;

/**
 * @internal
 */
export class AdapterHost extends EnhancedAsyncDisposable {
	private readonly _registry = new Set<AdapterConstructor>();
	private readonly _instances = new Map<AdapterConstructor, Adapter>();
	private readonly _nodes = new Map<BaseNodeConstructor, Adapter>();
	private readonly logger;

	constructor() {
		super('AdapterHost');

		this.logger = createLogger(`adapter:host`);

		registerGlobalLifecycle(this);
	}

	async activate() {
		for (const Adapter of this._registry) {
			this.logger.debug`实例化 ${Adapter.name}`;
			const adapter = await this.adapterInstance(Adapter);
			this.logger.debug`  - ${adapter.options.packageJson.name} v${adapter.options.packageJson.version ?? '0'} [${adapter.options.packageJson.description}]`;
			this._instances.set(Adapter, adapter);
		}

		this.fulfillAddNodes();

		await Promise.all(
			Array.from(this._instances.values()).map(async (adapter) => {
				try {
					this.logger.log`激活 ${adapter.options.packageJson.name}`;
					await adapter.activate();

					this._register(adapter);

					this.logger.verbose`${adapter.options.packageJson.name} 已激活`;
				} catch (error) {
					const e = convertCaughtError(error);
					prettyPrintError('启动适配器失败', e);
					this.logger.fatal`activate failed ${adapter.options.packageJson.name}`;
				}
			}),
		);
	}

	private async adapterInstance(Adapter: AdapterConstructor) {
		const packageJson = await reflectBinding.getPackageJson(Adapter);
		const instance = new Adapter({ packageJson });
		return instance;
	}

	getNodeInfo(constructor: Function): INodeInfo {
		const adapter = this._nodes.get(constructor as BaseNodeConstructor);
		if (!adapter) {
			this.logger.info`${[...this._nodes.keys().map((e) => e.name)]}`;
			throw new Error(`未找到节点信息，构造函数: ${constructor.name}，是否正确使用 @adapterHost.addNode 注册了节点？`);
		}

		return {
			constructorName: constructor.name,
			adapter,
			package: {
				name: adapter.options.packageJson.name,
				description: adapter.options.packageJson.description,
				version: adapter.options.packageJson.version,
			},
		};
	}

	addNode(node: BaseNodeConstructor) {
		const caller = getErrorFrame(new Error(), 1);
		const filepath = caller.replace(prefix, '').replace(endingRowCol, '');
		this.deferAddNodes.push([node, filepath]);
	}

	private readonly deferAddNodes: [BaseNodeConstructor, string][] = [];
	private fulfillAddNodes() {
		for (const [NodeClass, filepath] of this.deferAddNodes) {
			const AdapterClass = this.getAdapterClassAt(filepath);
			if (!AdapterClass) {
				this.logger.fatal`未找到适配器类，无法注册节点 ${NodeClass.name}，来源路径 relative<${filepath}>`;
				break;
			}

			const adapter = this._instances.get(AdapterClass);
			if (!adapter) {
				throw new SoftwareDefectError(`实例化顺序异常`);
			}

			this._addNode(NodeClass, adapter);
		}
	}

	/**
	 * @internal
	 */
	_addNode(node: BaseNodeConstructor, adapter: Adapter) {
		const exists = this._nodes.get(node);
		if (exists) {
			this.logger.verbose`节点${node.name}已经注册过了(${exists.options.packageJson.name})`;
			if (exists !== adapter) {
				throw new Error(`节点${node.name}已注册到"${exists.options.packageJson.name}"，重复注册到"${adapter.options.packageJson.name}"`);
			}
			return;
		}

		this.logger.debug`注册节点 ${node.name} 属于适配器${adapter.options.packageJson.name}`;
		this._nodes.set(node, adapter);
	}

	register(Adapter: AdapterConstructor) {
		const caller = getErrorFrame(new Error(), 1);
		const filepath = caller.replace(prefix, '').replace(endingRowCol, '');
		const packagePath = reflectBinding.getPackageJsonPath(filepath);

		const Exists = this.getAdapterClassAt(packagePath);
		if (Exists) {
			this.logger.fatal`一个包不允许注册多个适配器，包 relative<${packagePath}> 中同时发现 ${Exists.name} 和 ${Adapter.name}`;
		}

		this.logger.debug`注册适配器 ${Adapter.name}，来源包 relative<${packagePath}>`;

		reflectBinding.addClass(Adapter, packagePath);
		this._registry.add(Adapter);
	}

	private getAdapterClassAt(filepath: string) {
		for (const Item of reflectBinding.getClasses(filepath, true)) {
			if (Item.prototype instanceof Adapter) {
				return Item as AdapterConstructor;
			}
		}
		return null;
	}
}

export const adapterHost = globalSingletonStrong('AdapterHost', () => new AdapterHost());
