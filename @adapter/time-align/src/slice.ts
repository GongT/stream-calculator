import { calculateBytesPerMillisecond, CalculatorNode } from '@core/core';
import type { IDataFrame, TypeArray } from '@core/protocol';
import { SoftwareDefectError } from '@idlebox/common';

interface IOptions {
	readonly name: string;
	/**
	 * 输出数据的时间片长度，单位毫秒
	 */
	readonly timeSlice: number;
}

interface IBuffer {
	timeCursor: number;
	readonly rate: number;

	contents: Buffer;
}

/**
 * 时间对齐切片
 *
 * 经过此节点后，每个包的数据恒为timeSlice毫秒的数据
 */
export class TimeSlice extends CalculatorNode<TypeArray.Any> {
	private readonly timeSlice: number;

	private readonly buffers = new Map<number, IBuffer>();

	constructor(options: IOptions) {
		super(options.name);

		this.timeSlice = options.timeSlice;
	}

	override resume() {
		if (this.sources.length > 1) {
			throw new Error('TimeSlice必须只有一个输入源');
		}
	}

	private getBuffer(functionNumber: number, thatData: IDataFrame<TypeArray.Any>): IBuffer {
		let buffer = this.buffers.get(functionNumber);
		if (!buffer) {
			let time = thatData.timestamp;
			if (time % this.timeSlice !== 0) {
				const timeDeltaMs = time % this.timeSlice;

				// 对齐到前一个时间片
				time = time - timeDeltaMs;

				// 差出的数据用0填充
				const padding = Buffer.alloc(calculateBytesPerMillisecond(thatData.rate, thatData.content.constructor) * timeDeltaMs);
				const concatenatedBuffer = Buffer.concat([padding, Buffer.from(thatData.content.buffer)]).buffer;

				const Class = thatData.content.constructor as typeof Uint8Array;
				Object.assign(thatData, { content: new Class(concatenatedBuffer) }); // 强制重写只读属性
			}
			buffer = {
				timeCursor: time,
				rate: thatData.rate,
				contents: Buffer.alloc(),
			};
			this.buffers.set(functionNumber, buffer);
		} else if (thatData.rate !== buffer.rate) {
			throw new SoftwareDefectError(`同一functionNumber的数据采样率不一致，之前是 ${buffer.rate}Hz，现在是 ${thatData.rate}Hz`);
		}
		return buffer;
	}

	override async process(data: IDataFrame<TypeArray.Any>) {
		const buffer = this.getBuffer(data.functionNumber ?? 0, data);


	}
}

application.adapters.registerNode(TimeSlice);
