import type { IDataFrame, IWithType, TypeArray } from '@core/protocol';
import { Duplex, PassThrough } from 'node:stream';
import { AbstractNode } from './node.abstract.js';
import { SendorNode } from './node.read.js';
import { FinalizedNode } from './node.write.js';
import type { RS, WS } from './private.js';
import type { INode } from './types.js';

/** @internal */
export type ConstructInfo = {
	readonly id: string;
	readonly displayName: string;
};

function copyPrototype(from: any, to: any) {
	const keys = Object.getOwnPropertyNames(from.prototype);
	for (const key of keys) {
		if (key === 'constructor') continue;
		const desc = Object.getOwnPropertyDescriptor(from.prototype, key);
		if (!desc) continue;
		Object.defineProperty(to.prototype, key, desc);
	}
}

/**
 * 既出又进的节点
 */
export abstract class CalculatorNode<T extends TypeArray.Any = TypeArray.Any> extends AbstractNode implements INode<true, true> {
	// HACK COPY
	declare readonly _handleStreamData: (data: IDataFrame<T>, _enc: any, callback: (err?: Error) => void) => Promise<void>;
	declare readonly pipeTo: (target: INode<unknown, true>) => typeof target;
	protected declare readonly assertSingleInput: () => void;
	static {
		copyPrototype(SendorNode, CalculatorNode);
		copyPrototype(FinalizedNode, CalculatorNode);
	}
	// HACK COPY

	override readonly isSender = true;
	override readonly isReceiver = true;

	private readonly _sources: (INode<true, unknown> & RS)[] = [];
	readonly sources: readonly INode[] = this._sources;

	private readonly _targets: (INode<unknown, true> & WS)[] = [];
	readonly targets: readonly INode[] = this._targets;

	private readonly stream;

	constructor(displayName?: string) {
		super(displayName);

		this.stream = this.__manage_stream(
			new Duplex({
				objectMode: true,
				read() {},
				write: this._handleStreamData.bind(this),
			}),
		);
	}

	/**
	 * @param data 新产生的数据
	 * @param metadata 可选的元数据，会被下游的process收到
	 */
	protected declare readonly emitData: (data: IDataFrame<T>, metadata?: IWithType) => void;

	/**
	 * 处理接收到的数据
	 * *data共享，如需修改必须复制*
	 * @virtual
	 */
	protected abstract process(data: IDataFrame<T>, metadata?: IWithType): void | Promise<void>;

	/**
	 * 节点重连 = 跳过此节点
	 * 破坏性操作，无法回复
	 */
	protected rewire() {
		if (!this.isReceiver || !this.isSender) {
			throw new Error(`节点 "${this.displayName}" 不是可读写的节点，无法重连`);
		}
		const self = this.stream;

		// 断开所有输出
		this.stream.unpipe();

		for (const source of this._sources) {
			// 断开每个输入
			source.stream.unpipe(self);
		}

		// 替换stream
		(this as any).stream = new PassThrough({ objectMode: true });

		// 重连输入输出
		for (const source of this._sources) {
			source.stream.pipe(this.stream);
		}
		for (const target of this._targets) {
			this.stream.pipe(target.stream);
		}

		// 结束当前stream
		self.end();
	}
}
