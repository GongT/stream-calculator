import type { IDataFrame } from '@core/protocol';
import { convertCaughtError, createStackTraceHolder, ExitCode, inspectSymbol, prettyPrintError, SoftwareDefectError, timeout, TimeoutError } from '@idlebox/common';
import { shutdown } from '@idlebox/node';
import { Readable, Writable } from 'node:stream';
import type { InspectContext } from 'node:util';
import { NodeTools } from './node-tools.js';
import { privateStream, type INode, type INodeStatus } from './types.js';

/**
 * @internal
 */
export type INodeConstruct = new (...args: any[]) => AbstractNode;

/** @internal */
export abstract class AbstractNode extends NodeTools implements INode {
	isReceiver = false;
	isSender = false;

	public readonly onError = this._onError.event;

	public readonly statistic: INodeStatus = {
		sent: 0,
		sentBytes: 0,
		received: 0,
		receivedBytes: 0,
		error: 0,
	};

	constructor(name: string) {
		super(name);

		this.adapter._registerNodeInstance(this);

		this.logger.verbose`构造 | ${this.displayName} | serial = ${this.serial}`;
	}

	// ------------------ 生命周期
	/**
	 * 节点可实现此方法来进行异步初始化
	 * @virtual
	 */
	protected _initialize(): Promise<void> | void {}
	/**
	 * 当程序开始运行时会调用此方法，开始产生、处理数据
	 * @virtual
	 */
	protected _resume(): void {}

	private hasInitialized?: Promise<void>;

	public initialize() {
		if (this.hasInitialized) return this.hasInitialized;

		const stream = privateStream(this);
		stream.on('error', (e) => {
			if (this.disposing || this.disposed) {
				return;
			}
			const err = convertCaughtError(e);
			prettyPrintError(`${this.displayName} 处理出错`, err);
			this._onError.fire(err);
			stream.destroy();
			shutdown(ExitCode.EXECUTION);
		});

		const stackTrace = createStackTraceHolder('', this.constructor);
		this.hasInitialized = Promise.race([this._initialize(), timeout(5000, '未响应')]).then(
			() => {
				this.logger.verbose`初始化完成: ${this.displayName}(${this.serial})`;
			},
			(e) => {
				if (e instanceof TimeoutError) {
					throw new SoftwareDefectError(`初始化节点 ${this.displayName}(${this.serial}) 超时`, {
						cause: stackTrace,
					});
				}
				throw new SoftwareDefectError(`初始化节点 ${this.displayName}(${this.serial}) 出错`, {
					cause: convertCaughtError(e),
				});
			},
		);

		return this.hasInitialized;
	}

	public resume() {
		this._resume();
	}

	// ------------------ 工具方法
	public get stats(): Readonly<typeof this.statistic> {
		return this.statistic;
	}

	protected getSourceNodeId(data: IDataFrame<any>) {
		const id = data.flow?.at(-1);
		if (!id) {
			throw new SoftwareDefectError(`收到未知数据帧，flow = ${data.flow}`);
		}
		return id;
	}

	private readonly _func_multiplex_context: Record<number, any> = {};
	/**
	 * 可在process()中调用，根据data.functionNumber对数据进行分类，维护独立的上下文
	 */
	protected multiplexFunction<R>(data: IDataFrame, fn: (this: this, context: any, isNew: boolean) => R) {
		const functionNumber = data.functionNumber ?? 0;
		const isNew = this._func_multiplex_context[functionNumber] === undefined;
		if (isNew) this._func_multiplex_context[functionNumber] = {};
		return fn.call(this, this._func_multiplex_context[functionNumber], isNew);
	}

	private readonly _source_multiplex_context = new Map<string, any>();
	/**
	 * 可在process()中调用，根据数据的来源节点对数据进行分类，维护独立的上下文
	 */
	protected multiplexSource<R>(data: IDataFrame, fn: (this: this, context: any, isNew: boolean) => R) {
		const nodeId = this.getSourceNodeId(data);
		const isNew = !this._source_multiplex_context.has(nodeId);
		if (isNew) this._source_multiplex_context.set(nodeId, {});
		return fn.call(this, this._source_multiplex_context.get(nodeId), isNew);
	}

	/**
	 * 可在process()中调用，根据数据的来源节点和functionNumber对数据进行分类，维护独立的上下文
	 */
	protected multiplexMatrix<R>(data: IDataFrame, fn: (this: this, context: any, isNew: boolean) => R) {
		return this.multiplexSource(data, (ctx: Record<number, any>) => {
			const functionNumber = data.functionNumber ?? 0;
			const isNew = ctx[functionNumber] === undefined;
			if (isNew) ctx[functionNumber] = {};
			return fn.call(this, ctx[functionNumber], isNew);
		});
	}

	[inspectSymbol](depth: number, options: InspectContext) {
		let str = options.stylize(`[Node ${this.id}/${this.serial}]`, 'special');
		if (depth <= 0) {
			return str;
		}
		str += ' ';
		str += options.stylize(this.displayName, 'string');
		str += ' ';
		str += options.stylize(this.nodeGuid, 'string');
		str += ' {\n  stream: ';

		const streamState = [];
		const stream = privateStream(this);
		if (stream instanceof Readable) {
			streamState.push(`readable=${stream.readableLength}`);
		}
		if (stream instanceof Writable) {
			streamState.push(`writable=${stream.writableLength}`);
		}
		if (stream.destroyed) {
			streamState.push(`destroyed`);
		}
		if (stream.closed) {
			streamState.push(`closed`);
		}
		if (stream.errored) {
			streamState.push(`\x1B[38;5;9mError\x1B[0m`);
		}

		str += options.stylize(`[${stream.constructor.name}]`, 'special');
		str += ' { ';
		str += streamState.join(', ');
		str += ' },\n';

		str += `  send: ${options.stylize(this.statistic.sent.toString(), 'number')} frames ${options.stylize(this.statistic.sentBytes.toString(), 'number')} bytes,\n`;
		str += `  receive: ${options.stylize(this.statistic.received.toString(), 'number')} frames ${options.stylize(this.statistic.receivedBytes.toString(), 'number')} bytes,\n`;
		str += `  error: ${options.stylize(this.statistic.error.toString(), 'number')}\n`;

		str += '}';

		return str;
	}
}
