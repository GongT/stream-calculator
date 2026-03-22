import { Emitter, EnhancedAsyncDisposable, functionToDisposable, linux_case_hyphen } from '@idlebox/common';
import { createLogger } from '@idlebox/logger';
import { isShuttingDown } from '@idlebox/node';
import { execa, type Options as _ExecOptions } from 'execa';
import { basename } from 'node:path';
import type { Writeable } from '../common/functions.js';
import { makeLoggerStream } from '../common/logging-stream.js';

export interface ExecOpts extends Omit<_ExecOptions, 'stdio'> {
	stdio?: never;
}

/** @internal */
export abstract class AbstractBaseNode extends EnhancedAsyncDisposable {
	private readonly _onError = this._register(new Emitter<Error>());
	public readonly onError = this._onError.event;

	protected readonly logger;
	public readonly id: string;
	public override readonly displayName: string;

	protected readonly adapter;

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
		this.logger = createLogger(`node:${this.id}`);

		if (displayName) {
			this.displayName = `${nodeInfo.package.description}(${displayName})`;
		} else {
			this.displayName = nodeInfo.package.description;
		}
	}

	protected fireError(e: Error) {
		this._onError.fire(e);
		if (this._onError.listenerCount() === 0) {
			this.logger.error`发生错误但没有监听器: ${e.stack ?? e.message}`;
			setTimeout(() => {
				throw e;
			}, 0);
		}
	}

	protected spawnWorker<Opt extends ExecOpts = ExecOpts>(commandline: string[], options: Opt) {
		const proc = this.exec(commandline, options);

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

		this._register(
			functionToDisposable(function killProcess() {
				process.kill();
			}),
		);

		process.then(
			(result) => {
				this.logger.verbose`子进程 ${process.pid} 已退出: ${result.exitCode} / ${result.signal}`;
			},
			(e) => {
				this.logger.debug`子进程 ${process.pid} 异常退出: ${e.message}`;
			},
		);

		return process;
	}
}
