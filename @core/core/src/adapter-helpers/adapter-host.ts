import { convertCaughtError, EnhancedAsyncDisposable, getErrorFrame, prettyPrintError, SoftwareDefectError } from '@idlebox/common';
import type{  IMyLogger } from '@idlebox/logger';
import { rememberDeclareation } from '../common/debug.js';
import { reflectBinding } from '../package-reflect/binding.js';
import type { INodeConstruct } from '../stream/node.abstract.js';
import type { INode } from '../stream/types.js';
import { Adapter, type IBaseAdapterOptions } from './adapter.js';

type AdapterConstructor = new (options: IBaseAdapterOptions) => Adapter;

/**
 * @internal
 */
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
 * 一个Adapter的单例列表
 * @internal
 */
export class AdapterHost extends EnhancedAsyncDisposable {
	private readonly _registry = new Set<AdapterConstructor>();
	private readonly _instances = new Map<AdapterConstructor, Adapter>();
	private readonly _nodeClasses = new Map<INodeConstruct, Adapter>();

	constructor(public readonly logger: IMyLogger) {
		super('AdapterHost');
	}

	get instances() {
		return this._instances.values();
	}

	get nodes(): IteratorObject<INode> {
		return this._instances.values().flatMap((item) => item.getNodes());
	}

	async activate() {
		for (const Adapter of this._registry) {
			this.logger.log`实例化 ${Adapter.name}`;
			const adapter = await this.makeAdapterInstance(Adapter);
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

					this.logger.debug`${adapter.options.packageJson.name} 已激活`;
				} catch (error) {
					const e = convertCaughtError(error);
					prettyPrintError('适配器激活失败', e);
					this.logger.fatal`activate failed ${adapter.options.packageJson.name}`;
				}
			}),
		);
	}

	private async makeAdapterInstance(Adapter: AdapterConstructor) {
		const packageJson = await reflectBinding.getPackageJson(Adapter);
		const instance = new Adapter({ packageJson });
		return instance;
	}

	getNodeInfo(constructor: Function): INodeInfo {
		const adapter = this._nodeClasses.get(constructor as INodeConstruct);
		if (!adapter) {
			this.logger.info`${[...this._nodeClasses.keys().map((e) => e.name)]}`;
			throw new Error(`未找到节点信息，构造函数: ${constructor.name} (是否正确使用 @adapterHost.registerNode 注册了节点？) `);
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

	registerNode(node: INodeConstruct) {
		const caller = getErrorFrame(new Error(), 1);
		const filepath = caller.replace(prefix, '').replace(endingRowCol, '');
		this.deferAddNodes.push([node, filepath]);
	}

	private readonly deferAddNodes: [INodeConstruct, string][] = [];
	private fulfillAddNodes() {
		for (const [NodeClass, filepath] of this.deferAddNodes) {
			const AdapterClass = this.getAdapterClassAt(filepath);
			if (!AdapterClass) {
				this.logger
					.fatal`当前包中未找到适配器类 (是否正确使用 @adapterHost.registerAdapter 注册了适配器？)，无法注册节点 ${NodeClass.name}，来源路径 relative<${filepath}>`;
				break;
			}

			const adapter = this._instances.get(AdapterClass);
			if (!adapter) {
				throw new SoftwareDefectError(`实例化顺序异常`);
			}

			rememberDeclareation(NodeClass, filepath, true);
			this._addNodeClass(NodeClass, adapter);
		}
	}

	/**
	 * @internal
	 */
	private _addNodeClass(node: INodeConstruct, adapter: Adapter) {
		const exists = this._nodeClasses.get(node);
		if (exists) {
			this.logger.verbose`节点${node.name}已经注册过了(${exists.options.packageJson.name})`;
			if (exists !== adapter) {
				throw new Error(`节点${node.name}已注册到"${exists.options.packageJson.name}"，重复注册到"${adapter.options.packageJson.name}"`);
			}
			return;
		}

		this.logger.debug`注册节点 ${node.name} 属于适配器${adapter.options.packageJson.name}`;
		this._nodeClasses.set(node, adapter);
	}

	registerAdapter(Adapter: AdapterConstructor) {
		const caller = getErrorFrame(new Error(), 1);
		const filepath = caller.replace(prefix, '').replace(endingRowCol, '');
		const packagePath = reflectBinding.getPackageJsonPath(filepath);

		const Exists = this.getAdapterClassAt(packagePath);
		if (Exists) {
			this.logger.fatal`一个包不允许注册多个适配器，包 relative<${packagePath}> 中同时发现 ${Exists.name} 和 ${Adapter.name}`;
		}

		this.logger.debug`注册适配器 ${Adapter.name}，来源包 relative<${packagePath}>`;

		rememberDeclareation(Adapter, filepath, true);
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
