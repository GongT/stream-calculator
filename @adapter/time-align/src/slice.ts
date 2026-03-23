import { calculateDataPoints, calculateTimeDelta, CalculatorNode, concatTypedArrays } from '@core/core';
import type { IDataFrame, TimestampT, TypeArray } from '@core/protocol';

interface IOptions {
	readonly name: string;
	/**
	 * 输出数据的时间片长度，单位微秒
	 */
	readonly duration: TimestampT;
}

interface IBuffer {
	Class: TypeArray.C;
	contents: TypeArray.Any;
	startTime: number;
	points: number;
}

/**
 * 重整包大小
 *
 * 经过此节点后，每个包的数据恒为 duration 微秒的数据
 * 可缩可放
 *
 * 此节点对functionNumber做多路复用
 */
export class FrameResizer extends CalculatorNode<TypeArray.Any> {
	private readonly duration: TimestampT;

	constructor(options: IOptions) {
		super(options.name);

		this.duration = options.duration;
	}

	override process(data: IDataFrame<TypeArray.Any>) {
		return this.multiplexFunction(data, (ctx: IBuffer, isNew) => {
			if (isNew) {
				ctx.Class = data.content.constructor as TypeArray.C;
				ctx.contents = new ctx.Class(0);
				ctx.startTime = 0;
				ctx.points = calculateDataPoints(this.duration, data.rate);
			}

			if (Math.abs(data.timestamp - ctx.startTime) > this.duration / 2) {
				// 如果数据帧的timestamp与当前时间片的startTime相差过大
				this.logger.warn`数据帧的timestamp与当前时间片的startTime相差过大，数据源的时钟不准确，报告时间=${data.timestamp}, 采样点计数时间=${ctx.startTime}`;
			}

			const { timestamp, remains } = this.cut(
				{
					...data,
					timestamp: ctx.startTime,
					content: concatTypedArrays([ctx.contents, data.content]),
				},
				ctx.points,
			);

			ctx.startTime = timestamp;
			ctx.contents = remains;
		});
	}

	private cut(data: IDataFrame<TypeArray.Any>, points: number) {
		let cursor = data.timestamp;
		while (data.content.length > points) {
			const slice = data.content.slice(0, points);

			this.emitData({
				...data,
				timestamp: Math.floor(cursor),
				content: slice,
			});

			cursor += calculateTimeDelta(points, data.rate);
			data.content = data.content.slice(points);
		}

		return {
			remains: data.content,
			timestamp: cursor,
		};
	}
}

application.adapters.registerNode(FrameResizer);
