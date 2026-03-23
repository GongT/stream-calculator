import { EnhancedAsyncDisposable, type DeepReadonly, type IPackageJson } from '@idlebox/common';
import type { AbstractNode } from '../stream/node.abstract.js';
import type { INode } from '../stream/types.js';

export interface IBaseAdapterOptions {
	readonly packageJson: DeepReadonly<IPackageJson>;
}

/**
 * 适配器类
 * Node的容器（列表）
 */
export abstract class Adapter extends EnhancedAsyncDisposable {
	private readonly nodes: AbstractNode[] = [];

	constructor(public readonly options: IBaseAdapterOptions) {
		super(`Adapter<${options.packageJson.name}>`);
	}

	public abstract activate(): void | Promise<void>;

	/** @internal */
	_registerNodeInstance(node: AbstractNode) {
		this._register(node);
		this.nodes.push(node);
	}

	public getNodes(): ArrayIterator<INode> {
		return this.nodes.values();
	}
}
