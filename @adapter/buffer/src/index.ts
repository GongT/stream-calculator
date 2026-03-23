import { Adapter, CalculatorNode, FinalizedNode } from '@core/core';
import type { IDataFrame, TimestampT, TypeArray } from '@core/protocol';
import { NotImplementedError } from '@idlebox/common';

interface IStabOptions {
	name: string;

	/**
	 * 最多等待几个包
	 */
	bufferSize?: number;
	/**
	 * 缓存超时
	 */
	timeoutMicro?: TimestampT;

	/**
	 * 超时处理方式
	 *  - ignore: 丢弃没有及时到达的包（默认）
	 *  - fill: 用0填充没有及时到达的包
	 */
	timeoutAction?: 'ignore' | 'fill';

	/**
	 * 丢包回调，当为fill时不会触发
	 * @param functionNumber 功能编号
	 * @param timestamp 丢的包的timestamp
	 * @param duration 下一个没丢的包的timestamp - 丢的包的timestamp
	 */
	onPacketLoss?: (functionNumber: number, timestamp: TimestampT, duration: TimestampT) => void;
}

/**
 * 不稳定数据缓冲
 *
 * 输入的timestamp可以不按顺序，输出将按顺序发出
 *
 * 本节点只允许一个输入源
 * 本节点对functionNumber做多路复用
 */
export class InputStabilizer extends CalculatorNode<TypeArray.Any> {
	constructor(options: IStabOptions) {
		super(options.name);
	}

	override async process(_data: IDataFrame<TypeArray.Any>) {
		throw new NotImplementedError();
	}
}
application.adapters.registerNode(InputStabilizer);

interface IBuffOptions {
	readonly name: string;

	/**
	 * 缓冲区容量，单位是微秒
	 */
	readonly bufferDuration: TimestampT;
}

/**
 * 数据输出缓冲
 *
 * 缓存最近N微秒的数据，提供接口可以随时获取这些数据
 *
 * 本节点只允许一个输入源
 * 对functionNumber做多路复用
 */
export class StreamBuffer<T extends TypeArray.Any> extends FinalizedNode<T> {
	constructor(options: IBuffOptions) {
		super(options.name);
	}

	public getDataBuffer(): IDataFrame<T>[] {
		return [];
	}

	override async process(_data: IDataFrame<T>) {
		throw new NotImplementedError();
	}
}
application.adapters.registerNode(StreamBuffer);

class BufferAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}

application.adapters.registerAdapter(BufferAdapter);
