import type { IDataFrame, SupportedTypedArray } from '@core/protocol';
import { convertCaughtError, definePublicConstant, EnhancedAsyncDisposable, linux_case_hyphen } from '@idlebox/common';
import { createLogger } from '@idlebox/logger';
import { basename } from 'node:path';
import { Duplex, Readable, Writable } from 'node:stream';
import { adapterHost } from '../adapter-helpers/adapter-host.js';
import type { IBaseStreamNode, IReadableStreamNode, IReadWriteStreamNode, IWritableStreamNode } from './types.js';

const idx = new Map<string, number>();
function getSerialNumber(id: string) {
	const count = idx.get(id) ?? 0;
	idx.set(id, count + 1);
	return count;
}

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
export abstract class BaseNode<T extends SupportedTypedArray = any> extends EnhancedAsyncDisposable implements IBaseStreamNode {
	readonly isSender: boolean = false;
	readonly isReceiver: boolean = false;
	protected abstract readonly expectDataType: new () => T;

	protected readonly stream!: NodeJS.ReadWriteStream | NodeJS.ReadableStream | NodeJS.WritableStream;
	protected readonly logger;

	public readonly id: string;
	public readonly serial: number;
	public override readonly displayName: string;

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
		super();

		const info = this.makeInfo(displayName);
		this.id = info.id;
		this.displayName = info.displayName;
		this.serial = getSerialNumber(this.id);
		this.logger = createLogger(`node:${this.id}`);
		this.logger.verbose`构造 | ${this.displayName} | serial = ${this.serial}`;
		BaseNode.allInstances.push(this);
	}

	private static readonly allInstances: BaseNode[] = [];
	static async getAllInstances(): Promise<BaseNode[]> {
		const r = [];
		for (const node of BaseNode.allInstances) {
			await node.__initialize();
			r.push(node);
		}
		return r;
	}

	protected makeInfo(displayName?: string): ConstructInfo {
		const nodeInfo = adapterHost.getNodeInfo(this.constructor);

		let _displayName: string;
		if (displayName) {
			_displayName = `${nodeInfo.package.description}(${displayName})`;
		} else {
			_displayName = nodeInfo.package.description;
		}

		const bname = basename(nodeInfo.package.name);
		let id = `${bname}:${nodeInfo.constructorName}`;
		if (bname === linux_case_hyphen(nodeInfo.constructorName)) {
			id = bname;
		}

		return {
			id,
			displayName: _displayName,
		};
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

	protected __create_stream() {
		let constructor;
		if (this.isSender && this.isReceiver) {
			constructor = Duplex;
		} else if (this.isSender) {
			constructor = Readable;
		} else if (this.isReceiver) {
			constructor = Writable;
		} else {
			this.logger.fatal`节点 ${this.displayName} 既不可读也不可写，无法创建流`;
			throw new Error(`节点 "${this.displayName}" 既不可读也不可写，无法创建流`);
		}

		const stream = new constructor({ objectMode: true, read() {} });
		if (this.isReceiver) {
			stream.on('data', async (data: IDataFrame<T>) => {
				this.logger.debug` <<< ${data}`;

				if (!(data.content instanceof this.expectDataType)) {
					this.logger.error`数据类型不匹配: 期望 ${this.expectDataType.name}，但收到 ${data.content.constructor.name}`;
					this.statistic.error++;
					return;
				}

				this.statistic.received++;
				this.statistic.receivedBytes += data.content.byteLength;

				try {
					await this.process(data);
				} catch (err) {
					const e = convertCaughtError(err);
					this.logger.error`处理失败: ${e}`;
					this.statistic.error++;
				}
			});
		}

		if (!this.isSender) {
			this.emitData = (data: any) => {
				this.logger.fatal`试图向不可读节点 ${this.displayName} 发出数据: ${data}`;
			};
		}

		return stream;
	}

	private hasInitialized?: Promise<this>;
	/**
	 * @internal
	 */
	private async __initialize() {
		if (this.hasInitialized) return this.hasInitialized;

		this.__check();
		definePublicConstant(this, 'stream', this.__create_stream());

		this.hasInitialized = Promise.resolve(this.initialize()).then(() => this);
		await this.hasInitialized;

		this.logger.verbose`初始化完成: ${this.serial} - ${this.displayName}`;
		return this;
	}

	resume() {
		// 用于 override
	}

	protected initialize(): Promise<void> | void {
		// 用于 override
	}

	protected process(data: IDataFrame<T>): void | Promise<void> {
		throw new Error(`节点 "${this.displayName}" 未实现 process 方法，无法处理数据: ${data}`);
	}

	protected emitData(data: IDataFrame<T>) {
		this.logger.debug` >>> ${data}`;

		if (!(data.content instanceof this.expectDataType)) {
			this.logger.error`数据类型不匹配: 期望 ${this.expectDataType.name}，但试图发送 ${data.content.constructor.name}`;
			this.statistic.error++;
			return;
		}

		if (!data.functionNumber) data.functionNumber = 0;

		this.statistic.sent++;
		this.statistic.sentBytes += data.content.byteLength;
		(this.stream as Readable).push(data);
	}

	public pipeTo(...nodes: IBaseStreamNode[]) {
		if (!this.isSender) {
			throw new Error(`Cannot pipe from non-readable node "${this.displayName}"`);
		}
		this.__initialize();

		for (const node of nodes) {
			if (!node.isReceiver) {
				throw new Error(`Cannot pipe to non-writable node "${node.displayName}"`);
			}
			if (!(node instanceof BaseNode)) {
				throw new Error(`invalid node "${node.displayName}" not instance of BaseNode`);
			}

			node.__initialize();

			this.logger.debug`pipeTo: ${node.displayName} (${node.id}:${node.serial})`;
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
 */
export abstract class SendorNode<T extends SupportedTypedArray = any> extends BaseNode<T> implements IReadableStreamNode {
	override readonly isSender = true;
}

/**
 * 只进不出的节点
 */
export abstract class FinalizedNode<T extends SupportedTypedArray = any> extends BaseNode<T> implements IWritableStreamNode {
	override readonly isReceiver = true;
}

/**
 * 既出又进的节点
 */
export abstract class CalculatorNode<T extends SupportedTypedArray = any> extends BaseNode<T> implements IReadWriteStreamNode {
	override readonly isSender = true;
	override readonly isReceiver = true;
}
