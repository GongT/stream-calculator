import type { IDataFrame, IWithType, TypeArray } from '@core/protocol';
import { Readable } from 'node:stream';
import { AbstractNode } from './node.abstract.js';
import { isWritableNode, type WS } from './private.js';
import type { INode } from './types.js';

/**
 * 只出不进的节点
 * 传感器
 *
 * 应该调用 this.emitData 来发出数据
 */
export abstract class SendorNode<T extends TypeArray.Any = TypeArray.Any> extends AbstractNode implements INode<true, false> {
	override readonly isSender = true;

	private readonly _targets: (INode<unknown, true> & WS)[] = [];
	readonly targets: readonly INode[] = this._targets;

	private readonly stream = this.__manage_stream(
		new Readable({
			objectMode: true,
			read() {},
		}),
	);

	constructor(displayName?: string) {
		super(displayName);
		this._targets = [];
	}

	/**
	 * @param data 新产生的数据
	 * @param metadata 可选的元数据，会被下游的process收到
	 */
	protected emitData(data: IDataFrame<T>, metadata?: IWithType) {
		// this.logger.verbose` >>> ${data}`;

		const contentAsTyped = data.content as TypeArray.Any;

		if (data.functionNumber === undefined) data.functionNumber = 0;

		this.statistic.sent++;
		if (contentAsTyped.byteLength) {
			this.statistic.sentBytes += contentAsTyped.byteLength;
		}

		(this.stream as Readable).push({
			...data,
			flow: data.flow ? [...data.flow, this.nodeGuid] : [this.nodeGuid],
			metadata: metadata,
		});

		const alertSize = 1024 * 64;
		if ((this.stream as Readable).readableLength > alertSize) {
			this.logger.warn`节点 ${this.displayName} 输出缓冲区长度 ${(this.stream as Readable).readableLength} 超过警戒线 ${alertSize}`;
		}
	}

	public pipeTo(node: INode<AbstractNode, true>): typeof node {
		if (!this.isSender) {
			throw new Error(`Cannot pipe from non-readable node "${this.displayName}"`);
		}

		this.logger.debug`pipeTo: ${this.displayName}`;
		if (!isWritableNode(node)) {
			throw new Error(`Cannot pipe to non-writable node "${node.displayName}"`);
		}

		this.logger.debug`        -> ${node.displayName}`;

		this.stream.pipe(node.stream);

		this._targets.push(node);
		node._sources.push(this);

		return node;
	}
}
