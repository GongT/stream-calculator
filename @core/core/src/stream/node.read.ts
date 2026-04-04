import { DataPayload, type IDataFrame, type IWithType, type TypeArray } from '@core/protocol';
import { Readable } from 'node:stream';
import { AbstractNode } from './node.abstract.js';
import { isWritableNode, type IStreamObject, type WS } from './private.js';
import type { INode } from './types.js';

// const alertSize = 2000; // n个包，不一定多大

export interface IDataFrameToEmit<T extends TypeArray.Any> extends Omit<IDataFrame<T>, 'flow'> {
	readonly flow?: readonly string[];
}

/**
 * 只出不进的节点
 * 传感器
 *
 * 应该调用 this.emitData 来发出数据
 */
export abstract class SensorNode<T extends TypeArray.Any = TypeArray.Any> extends AbstractNode implements INode<true, false> {
	override readonly isSender = true;

	private readonly _targets: (INode<unknown, true> & WS)[] = [];
	readonly targets: readonly INode[] = this._targets;

	private readonly stream = new Readable({
		highWaterMark: 1000,
		objectMode: true,
		read() {},
	});

	constructor(name: string) {
		super(name);
		this._targets = [];
	}

	/**
	 * @param data 新产生的数据
	 * @param metadata 可选的元数据，会被下游的process收到
	 */
	protected emitData(data: DataPayload | IDataFrameToEmit<T>, metadata?: IWithType) {
		// this.logger.verbose` >>> ${data}`;

		let frame;
		if (data instanceof DataPayload) {
			frame = {
				content: data.asTypedArray<T>(),
				functionNumber: data.func ?? 0,
				rate: data.rate,
				timestamp: data.timestamp,
				flow: data.flowTo(this.nodeGuid),
			} satisfies IDataFrame<T>;
		} else {
			frame = {
				...data,
				flow: data.flow ? [...data.flow, this.nodeGuid] : [this.nodeGuid],
			} satisfies IDataFrame<T>;
		}

		this.statistic.sent++;
		if (data.content.byteLength) {
			this.statistic.sentBytes += data.content.byteLength;
		}

		(this.stream as Readable).push({
			frame: frame,
			metadata: metadata,
		} satisfies IStreamObject<T>);

		// if ((this.stream as Readable).readableLength > alertSize) {
		// 	this.logger.warn`节点 ${this.displayName} 输出缓冲区长度 ${(this.stream as Readable).readableLength} 超过警戒线 ${alertSize}`;
		// }
	}

	public pipeTo(node: INode<unknown, true>): typeof node {
		if (!this.isSender) {
			throw new Error(`Cannot pipe from non-readable node "${this.displayName}"`);
		}

		this.logger.debug`pipeTo: ${this.displayName}`;
		if (!isWritableNode(node)) {
			throw new Error(`Cannot pipe to non-writable node "${node.displayName}"`);
		}

		this.logger.debug`        -> ${node.displayName}`;

		this.stream.pipe(node.stream, { end: false });

		this._targets.push(node);
		node._sources.push(this);

		return node;
	}

	override resume() {
		super.resume();

		if (this.targets.length === 0) {
			this.logger.warn`输出没有连接到任何下游节点`;
			this.stream.resume(); // 丢弃数据
		}
	}
}
