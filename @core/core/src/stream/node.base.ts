import type { IDataFrame, TypeArray } from '@core/protocol';
import { convertCaughtError, definePublicConstant, SoftwareDefectError, timeout } from '@idlebox/common';
import { Duplex, Readable, Writable } from 'node:stream';
import { getSerialNumber, instanceOf } from '../common/functions.js';
import { AbstractBaseNode } from './node-tools.js';
import type { IBaseStreamNode, IReadableStreamNode, IReadWriteStreamNode, IWritableStreamNode } from './types.js';

/**
 * @internal
 */
export type BaseNodeConstructor = new (...args: any[]) => BaseNode;

/** @internal */
export type ConstructInfo = {
	readonly id: string;
	readonly displayName: string;
};

/**
 * @internal
 */
export abstract class BaseNode<T extends TypeArray.Any = TypeArray.Any> extends AbstractBaseNode implements IBaseStreamNode {
	readonly isSender: boolean = false;
	readonly isReceiver: boolean = false;
	protected abstract readonly expectDataType: new () => T;

	protected readonly stream!: NodeJS.ReadWriteStream | NodeJS.ReadableStream | NodeJS.WritableStream;
	public readonly serial: number;

	protected readonly statistic = {
		sent: 0,
		sentBytes: 0,
		received: 0,
		receivedBytes: 0,
		birth: Date.now(),
		error: 0,
	};

	public readonly targets: BaseNode[] = [];

	constructor(displayName?: string) {
		super(displayName);

		this.adapter._registerNodeInstance(this);

		this.serial = getSerialNumber(this.id);
		this.logger.verbose`构造 | ${this.displayName} | serial = ${this.serial}`;
	}

	protected __check() {
		if (!this.isSender) {
			this.emitData = () => {
				this.logger.fatal`试图向不可读节点 ${this.displayName} 发出数据`;
			};
		}
		if (this.isReceiver) {
			if (this.process === BaseNode.prototype.process) {
				this.logger.fatal`节点 ${this.displayName} writable 属性为 true，但未实现 process 方法`;
			}
		} else {
			if (this.process !== BaseNode.prototype.process) {
				this.logger.fatal`节点 ${this.displayName} 实现了 process 方法，但 writable 属性为 false`;
			}
		}
	}

	private async call_process(data: IDataFrame<T>) {
		// this.logger.verbose` <<< ${data}`;

		const WantClass = this.expectDataType;
		if (WantClass) {
			if (data.content instanceof WantClass === false) {
				this.logger.error`数据类型不匹配: 期望 ${WantClass.name}，但收到 ${data.content.constructor.name}`;
				this.statistic.error++;
				return;
			}
		}

		this.statistic.received++;
		this.statistic.receivedBytes += data.content.byteLength;

		try {
			await this.process(data);
		} catch (err) {
			this.statistic.error++;
			throw convertCaughtError(err);
		}
	}

	private create_duplex_stream() {
		return new Duplex({
			objectMode: true,
			read() {},
			write: (chunk, _enc, callback) => {
				this.call_process(chunk)
					.then(() => callback())
					.catch(callback);
			},
		});
	}

	private create_readable_stream() {
		return new Readable({
			objectMode: true,
			read() {},
		});
	}

	private create_writable_stream() {
		return new Writable({
			objectMode: true,
			write: (chunk, _enc, callback) => {
				this.call_process(chunk)
					.then(() => callback())
					.catch(callback);
			},
		});
	}

	protected __create_stream() {
		let stream;
		if (this.isSender && this.isReceiver) {
			stream = this.create_duplex_stream();
		} else if (this.isSender) {
			stream = this.create_readable_stream();
		} else if (this.isReceiver) {
			stream = this.create_writable_stream();
			this.emitData = (data: any) => {
				this.logger.fatal`试图向不可读节点 ${this.displayName} 发出数据: ${data}`;
			};
		} else {
			this.logger.fatal`节点 ${this.displayName} 既不可读也不可写，无法创建流`;
			throw new Error(`节点 "${this.displayName}" 既不可读也不可写，无法创建流`);
		}

		if (this.isReceiver) {
			stream.on('data', (data: IDataFrame<T>) => {
				this.call_process(data).catch((e) => {
					stream.emit('error', e);
				});
			});
		}

		stream.on('error', (e) => {
			const err = convertCaughtError(e);
			this.logger.error`${this.displayName} [${this.stream.constructor.name}] 处理出错: ${err}`;
			throw err;
		});

		return stream;
	}

	private hasInitialized?: Promise<void>;
	/**
	 * @internal
	 */
	public __initialize() {
		if (this.hasInitialized) return this.hasInitialized;

		this.__check();
		definePublicConstant(this, 'stream', this.__create_stream());

		this.hasInitialized = Promise.race([this.initialize(), timeout(5000, '未响应')]).then(
			() => {
				this.logger.verbose`初始化完成: ${this.displayName}(${this.serial})`;
			},
			(e) => {
				throw new SoftwareDefectError(`初始化节点 ${this.displayName}(${this.serial}) 出错`, { cause: convertCaughtError(e) });
			},
		);

		return this.hasInitialized;
	}

	/**
	 * 异步初始化
	 * @virtual
	 */
	protected initialize(): Promise<void> | void {}

	/**
	 * 开始产生、处理数据
	 * @virtual
	 */
	resume() {}

	/**
	 * 处理接收到的数据
	 * *data共享，修改前必须复制*
	 *
	 * @virtual
	 */
	protected process(data: IDataFrame<T>): void | Promise<void> {
		throw new Error(`节点 "${this.displayName}" 未实现 process 方法，无法处理数据: ${data}`);
	}

	protected emitData(data: IDataFrame<T>) {
		// this.logger.verbose` >>> ${data}`;

		if (!instanceOf(data.content, this.expectDataType)) {
			// if (!((data.content as any) instanceof this.expectDataType)) {
			this.logger.error`数据类型不匹配: 期望 ${this.expectDataType.name}，但试图发送 ${data.content.constructor.name}`;
			this.statistic.error++;
			return;
		}

		if (!data.functionNumber) data.functionNumber = 0;

		this.statistic.sent++;
		this.statistic.sentBytes += data.content.byteLength;

		(this.stream as Readable).push(data);

		const alertSize = 1024 * 64;
		if ((this.stream as Readable).readableLength > alertSize) {
			this.logger.warn`节点 ${this.displayName} 输出缓冲区长度 ${(this.stream as Readable).readableLength} 超过警戒线 ${alertSize}`;
		}
	}

	public pipeTo(...nodes: IBaseStreamNode[]) {
		if (!this.isSender) {
			throw new Error(`Cannot pipe from non-readable node "${this.displayName}"`);
		}
		this.__initialize();

		if (!nodes.length) {
			throw new Error(`pipeTo requires at least one target node`);
		}

		this.logger.debug`pipeTo: ${this.displayName}`;
		for (const node of nodes) {
			if (!node.isReceiver) {
				throw new Error(`Cannot pipe to non-writable node "${node.displayName}"`);
			}
			if (!(node instanceof BaseNode)) {
				throw new Error(`invalid node "${node.displayName}" not instance of BaseNode`);
			}

			node.__initialize();

			this.logger.debug`        -> ${node.displayName}`;
			const target = node.stream as NodeJS.WritableStream;
			const source = this.stream as NodeJS.ReadableStream;
			source.pipe(target);
			this.targets.push(node);
		}

		return nodes[0];
	}

	public get stats(): Readonly<typeof this.statistic> {
		return this.statistic;
	}
}

/**
 * 只出不进的节点
 * 传感器
 *
 * 应该调用 this.emitData 来发出数据
 */
export abstract class SendorNode<T extends TypeArray.Any = TypeArray.Any> extends BaseNode<T> implements IReadableStreamNode {
	override readonly isSender = true;
}

/**
 * 只进不出的节点
 *
 * 应该实现 process 方法来处理数据
 */
export abstract class FinalizedNode<T extends TypeArray.Any = TypeArray.Any> extends BaseNode<T> implements IWritableStreamNode {
	override readonly isReceiver = true;
}

/**
 * 既出又进的节点
 *
 * 应该实现 process 方法来处理数据，并调用 this.emitData 来发出数据
 */
export abstract class CalculatorNode<T extends TypeArray.Any = TypeArray.Any> extends BaseNode<T> implements IReadWriteStreamNode {
	override readonly isSender = true;
	override readonly isReceiver = true;
}
