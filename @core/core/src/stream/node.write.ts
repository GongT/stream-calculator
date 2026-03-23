import type { IDataFrame, IWithType, TypeArray } from '@core/protocol';
import { convertCaughtError, prettyPrintError, SoftwareDefectError } from '@idlebox/common';
import { Writable } from 'node:stream';
import { AbstractNode } from './node.abstract.js';
import type { RS } from './private.js';
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

	constructor(displayName?: string) {
		super(displayName);
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

	private async _handleStreamData(data: IDataFrame<T>, _enc: any, callback: (err?: Error) => void) {
		// this.logger.verbose` <<< ${data}`;

		const contentAsTyped = data.content as TypeArray.Any;

		const metadata = (data as any).metadata;

		this.statistic.received++;

		if (contentAsTyped.byteLength) {
			this.statistic.receivedBytes += contentAsTyped.byteLength;
		}

		if (data.functionNumber === undefined) data.functionNumber = 0;

		try {
			await this.process(data, metadata);
			callback();
		} catch (e) {
			this.logger.warn`出错node数据源list<${this._sources.map((item) => item.displayName)}>\ndata = ${data}`;

			const err = convertCaughtError(e);
			this.statistic.error++;

			try {
				if (this._onError.listenerCount() === 0) {
					return callback(err);
				}
				this._onError.fire(err);
				callback();
			} catch (err2) {
				prettyPrintError(`[${this.displayName}] Error in error handler of node`, convertCaughtError(err2));
				callback(err);
			}
		}
	}
}
