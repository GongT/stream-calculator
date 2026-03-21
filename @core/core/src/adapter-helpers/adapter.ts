import { EnhancedAsyncDisposable, type DeepReadonly, type IPackageJson } from '@idlebox/common';
import type { BaseNode } from '../stream/node.base.js';

export interface IBaseAdapterOptions {
	readonly packageJson: DeepReadonly<IPackageJson>;
}

/**
 * 适配器类
 * Node的容器（列表）
 */
export abstract class Adapter extends EnhancedAsyncDisposable {
	private readonly nodes: BaseNode[] = [];

	constructor(public readonly options: IBaseAdapterOptions) {
		super(`Adapter<${options.packageJson.name}>`);
	}

	public abstract activate(): void | Promise<void>;

	/** @internal */
	_registerNodeInstance(node: BaseNode) {
		this._register(node);
		this.nodes.push(node);
	}

	public getNodes(): ArrayIterator<BaseNode> {
		return this.nodes.values();
	}
}
