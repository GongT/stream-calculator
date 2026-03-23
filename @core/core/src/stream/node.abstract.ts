import type { IDataFrame } from '@core/protocol';
import {
	convertCaughtError,
	createStackTraceHolder,
	Emitter,
	EnhancedAsyncDisposable,
	ExitCode,
	functionToDisposable,
	inspectSymbol,
	linux_case_hyphen,
	prettyPrintError,
	SoftwareDefectError,
	timeout,
	TimeoutError,
} from '@idlebox/common';
import { createLogger } from '@idlebox/logger';
import { isShuttingDown, shutdown } from '@idlebox/node';
import { execa, type Options as _ExecOptions } from 'execa';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { Readable, Writable } from 'node:stream';
import type { InspectContext } from 'node:util';
import type { Writeable } from '../common/functions.js';
import { getSerialNumber } from '../common/functions.js';
import { makeLoggerStream } from '../common/logging-stream.js';
import { privateStream, type INode, type INodeStatus } from './types.js';

/**
 * @internal
 */
export type INodeConstruct = new (...args: any[]) => AbstractNode;

export interface ExecOpts extends Omit<_ExecOptions, 'stdio'> {
	stdio?: never;
}

/** @internal */
export abstract class AbstractNode extends EnhancedAsyncDisposable implements INode {
	public readonly nodeGuid: string = randomUUID();

	isReceiver = false;
	isSender = false;

	protected readonly _onError = this._register(new Emitter<Error>());
	public readonly onError = this._onError.event;

	protected readonly logger;
	public readonly serial: number;
	public readonly id: string;
	public override readonly displayName: string;

	protected readonly adapter;

	public readonly statistic: INodeStatus = {
		sent: 0,
		sentBytes: 0,
		received: 0,
		receivedBytes: 0,
		error: 0,
	};

	constructor(displayName?: string) {
		super();

		const nodeInfo = application.adapters.getNodeInfo(this.constructor);

		this.adapter = nodeInfo.adapter;

		const bName = basename(nodeInfo.package.name);
		let id = `${bName}:${nodeInfo.constructorName}`;
		if (bName === linux_case_hyphen(nodeInfo.constructorName)) {
			id = bName;
		}
		this.id = id;
		this.serial = getSerialNumber(this.id);

		let logger = createLogger(`node:${this.id}`);
		if (this.serial) {
			logger = logger.extend(this.serial.toString());
		}
		this.logger = logger;

		if (displayName) {
			this.displayName = `${nodeInfo.package.description}(${displayName})`;
		} else {
			this.displayName = nodeInfo.package.description;
		}

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
			if (!this._onError.hasDisposed) {
				const err = convertCaughtError(e);
				prettyPrintError(`${this.displayName} 处理出错`, err);
				this._onError.fire(err);
				stream.destroy();
				shutdown(ExitCode.EXECUTION);
			}
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
	protected fireError(e: Error) {
		this._onError.fire(e);
		if (this._onError.listenerCount() === 0) {
			this.logger.error`发生错误但没有监听器: long<${e.stack ?? e.message}>`;
			setTimeout(() => {
				throw e;
			}, 0);
		}
	}

	public get stats(): Readonly<typeof this.statistic> {
		return this.statistic;
	}

	protected spawnWorker<Opt extends ExecOpts = ExecOpts>(commandline: string[], options: Opt) {
		const proc = this.exec(commandline, options);
		this.logger.info`process ${proc.pid} spawned.`;

		proc.then(
			(p) => {
				if (isShuttingDown()) return;

				// TODO: update @idlebox/common
				this.fireError(new Error(`子程序意外退出 (code=${p.exitCode || p.signal}): ${commandline.join(' ')}`));
			},
			(e) => {
				if (isShuttingDown()) return;

				this.fireError(new Error(`子程序意外退出\n   commandline = ${commandline.join(' ')}\n错误信息: ${e.message}`));
			},
		);

		return proc;
	}

	protected exec<Opt extends ExecOpts = ExecOpts>(commandline: string[], opts: Opt) {
		const options: Writeable<Opt> = { ...opts } as any;

		const stdout_should_wrap = options.stdout === 'inherit';
		const stderr_should_wrap = options.stderr === 'inherit';
		if (stdout_should_wrap) options.stdout = 'pipe';
		if (stderr_should_wrap) options.stderr = 'pipe';

		if (!options.env) options.env = {};
		Object.assign(options.env, {
			PYTHONUNBUFFERED: '1',
		});

		const process = execa(commandline[0], commandline.slice(1), options);
		this.logger.verbose`PID=${process.pid ?? '?'}`;

		if (stdout_should_wrap || stderr_should_wrap) {
			if (stdout_should_wrap) {
				process.stdout?.pipe(makeLoggerStream(this.logger, 'stdout'));
			}
			if (stderr_should_wrap) {
				process.stderr?.pipe(makeLoggerStream(this.logger, 'stderr'));
			}
		}

		const un = this._register(
			functionToDisposable(() => {
				this.logger.warn`正在杀死子进程 ${process.pid}...`;
				process.kill('SIGINT');
				return process;
			}),
		);

		process.then(
			(result) => {
				this.logger.verbose`子进程 ${process.pid} 已退出: ${result.exitCode} / ${result.signal}`;
				un.dispose();
			},
			(e) => {
				this.logger.debug`子进程 ${process.pid} 异常退出: ${e.message}`;
				un.dispose();
			},
		);

		return process;
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
