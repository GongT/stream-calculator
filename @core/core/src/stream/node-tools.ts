import { createProtocolSocket, type ICreateOptions } from '@core/protocol';
import { DuplicateDisposeAction, Emitter, EnhancedAsyncDisposable, linux_case_hyphen } from '@idlebox/common';
import { createLogger } from '@idlebox/logger';
import { childProcessToDisposable, isShuttingDown } from '@idlebox/node';
import { execa, type Options as _ExecOptions, type ResultPromise } from 'execa';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { Writeable } from '../common/functions.js';
import { getSerialNumber } from '../common/functions.js';
import { makeLoggerStream } from '../common/logging-stream.js';

export interface ExecOpts extends Omit<_ExecOptions, 'stdio' | 'detached'> {
	stdio?: never;
}

/** @internal */
export class NodeTools extends EnhancedAsyncDisposable {
	protected override readonly duplicateDispose = DuplicateDisposeAction.Allow;

	protected readonly _onError = this._register(new Emitter<Error>());
	protected readonly logger;

	public override readonly displayName: string;
	public readonly nodeGuid: string = randomUUID();
	public readonly serial: number;
	public readonly id: string;
	protected readonly adapter;

	constructor(public readonly name: string) {
		super(name);
		const nodeInfo = application.adapters.getNodeInfo(this.constructor);

		if (name) {
			this.displayName = `${nodeInfo.package.description}(${name})`;
		} else {
			this.displayName = nodeInfo.package.description;
		}

		this.adapter = nodeInfo.adapter;

		const bName = basename(nodeInfo.package.name);
		let id = bName;
		if (linux_case_hyphen(nodeInfo.constructorName) !== bName) {
			id += `:${nodeInfo.constructorName}`;
		}
		this.id = id;
		this.serial = getSerialNumber(this.id);

		let logger = createLogger(`node:${this.id}`);
		if (this.serial) {
			logger = logger.extend(this.serial.toString());
		}
		this.logger = logger;
	}

	protected async createProtocolSocket(options: ICreateOptions) {
		return this._register(await createProtocolSocket(options));
	}

	protected spawnWorker<Opt extends ExecOpts = ExecOpts>(commandline: string[], options: Opt): ResultPromise<Opt> {
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

	protected fireError(e: Error) {
		this._onError.fire(e);
		if (this._onError.listenerCount() === 0) {
			this.logger.error`发生错误但没有监听器: long<${e.stack ?? e.message}>`;
			setTimeout(() => {
				throw e;
			}, 0);
		}
	}

	protected exec<Opt extends ExecOpts = ExecOpts>(commandline: string[], opts: Opt): ResultPromise<Opt> {
		const options: Writeable<Opt> = { ...opts } as any;

		const stdout_should_wrap = options.stdout === 'inherit';
		const stderr_should_wrap = options.stderr === 'inherit';
		if (stdout_should_wrap) options.stdout = 'pipe';
		if (stderr_should_wrap) options.stderr = 'pipe';

		if (!options.env) options.env = {};
		Object.assign(options.env, {
			PYTHONUNBUFFERED: '1',
		});

		const process = execa<Opt>(commandline[0], commandline.slice(1), options as Opt);
		// process类型推断有问题

		this.logger.verbose`PID=${process.pid ?? '?'}`;
		this._register(childProcessToDisposable(process as any));

		if (stdout_should_wrap || stderr_should_wrap) {
			if (stdout_should_wrap) {
				process.stdout?.pipe(makeLoggerStream(this.logger, 'stdout'));
			}
			if (stderr_should_wrap) {
				process.stderr?.pipe(makeLoggerStream(this.logger, 'stderr'));
			}
		}

		process.then(
			(result) => {
				this.logger.debug`子进程 ${process.pid} 已退出: ${result.exitCode} / ${result.signal}`;
			},
			(e) => {
				if (this.disposing || this.disposed) {
					this.logger.debug`子进程 ${process.pid} 主动关闭`;
					this.logger.verbose`long<${e.message}>`;
				} else {
					this.logger.debug`子进程 ${process.pid} 异常退出: ${e.message}`;
				}
			},
		);

		return process as any;
	}
}
