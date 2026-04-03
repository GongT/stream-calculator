import type { IDataFrame, IWithType, TypeArray } from '@core/protocol';
import { convertCaughtError, prettyPrintError, Quit, SoftwareDefectError } from '@idlebox/common';
import { Writable } from 'node:stream';
import { AbstractNode } from './node.abstract.js';
import type { IStreamObject, RS } from './private.js';
import type { INode } from './types.js';

/**
 * 只进不出的节点
 */
export abstract class FinalizedNode<T extends TypeArray.Any = TypeArray.Any> extends AbstractNode implements INode<false, true> {
	override readonly isReceiver = true;

	private readonly _sources: (INode<true, unknown> & RS)[] = [];
	readonly sources: readonly INode[] = this._sources;

	private readonly stream = new Writable({
		highWaterMark: 1000,
		objectMode: true,
		write: this._handleStreamData.bind(this),
	});

	constructor(name: string) {
		super(name);
		+this.stream;
	}

	/**
	 * 处理接收到的数据
	 * *data共享，修改前必须复制*
	 *
	 * @virtual
	 */
	protected abstract process(data: IDataFrame<T>, _metadata?: IWithType): void | Promise<void>;

	/**
	 * 可在resume()中调用，断言此节点只有一个输入源
	 */
	protected assertSingleInput() {
		if (this._sources.length > 1) {
			throw new SoftwareDefectError(`${this.constructor.name}必须只有一个输入源`);
		}
	}

	private async _handleStreamData(data: IStreamObject<T>, _enc: any, callback: (err?: Error) => void) {
		// this.logger.verbose` <<< ${data}`;

		const contentTypedArray = data.frame.content;

		this.statistic.received++;

		if (contentTypedArray.byteLength) {
			this.statistic.receivedBytes += contentTypedArray.byteLength;
		}

		if (data.frame.functionNumber === undefined) data.frame.functionNumber = 0;

		try {
			await this.process(data.frame, data.metadata);
			callback();
		} catch (e) {
			if (this.disposed) throw new Quit();

			const err = convertCaughtError(e);
			Object.defineProperty(err, 'sources', {
				get: () => this._sources.map((item) => item.displayName),
			});

			this._handle_error(Object.assign(err, { data: data.frame }), callback);
		}
	}

	private _handle_error(err: Error & { data: IDataFrame<T> }, callback: (err?: Error) => void = () => {}) {
		this.statistic.error++;

		if (this._onError.listenerCount() === 0) {
			// nothing to do
		} else {
			try {
				this._onError.fire(err);

				// 成功自处理
				return callback();
			} catch (err2) {
				err = Object.assign(convertCaughtError(err2), { cause: err, data: err.data });
			}
		}

		this.logger.warn`出错node数据源list<${this._sources.map((item) => item.displayName)}>\ndata = ${err.data}`;
		prettyPrintError(`[${this.displayName}] Error in error handler of node`, convertCaughtError(err));

		callback(err);
	}
}
