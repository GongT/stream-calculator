import { calculateTimeDelta, CalculatorNode } from '@core/core';
import type { IDataFrame, TimestampT, TypeArray } from '@core/protocol';
import { SoftwareDefectError } from '@idlebox/common';

interface IOptions {
	readonly name: string;
}

/**
 * 重定时器
 *
 * 记录数据流的第一个timestamp，随后所有timestamp以此为基准，根据数据长度重新计算，而不使用数据包里的timestamp
 *
 * 相信来源的采样率极其精准的情况（如音频数据）
 * 不过这种源普遍时间戳也极其精准，所以这个功能的用途比较有限
 */
export class ReTimer extends CalculatorNode<TypeArray.U8> {
	private readonly buffers = new Map<string /* node id */, Record<number /* function number */, TimestampT>>();

	constructor(options: IOptions) {
		super(options.name);
	}

	override resume() {
		for (const source of this.sources) {
			this.buffers.set(source.nodeGuid, {});
		}
	}

	override async process(data: IDataFrame<TypeArray.U8>) {
		const rate = data.rate;
		const nodeGuid = data.flow?.at(-1);
		const map = this.buffers.get(nodeGuid ?? '');
		if (!map) {
			throw new SoftwareDefectError(`收到未知数据帧，flow = ${nodeGuid}`);
		}

		const fn = data.functionNumber ?? 0;

		let currentTime = map[fn];
		if (!currentTime) {
			// 以第一个数据帧的timestamp为基准
			currentTime = data.timestamp;
			map[fn] = currentTime;
		}

		// 重设此数据帧的timestamp为timeCursor
		data.timestamp = Math.floor(currentTime);

		// 计算数据帧的持续时间
		const duration = calculateTimeDelta(data.content.length, rate);
		map[fn] += duration;

		// 将重定时后的数据帧发送出去
		this.emitData(data);
	}
}

application.adapters.registerNode(ReTimer);
