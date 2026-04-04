import { Adapter, CalculatorNode } from '@core/core';
import type { IDataFrame, TimestampT, TypeArray } from '@core/protocol';

interface IOptions {
	readonly name: string;
	/**
	 * 目标采样率，单位 Hz，默认为 512Hz
	 */
	readonly targetRate?: number;

	/**
	 * 只处理指定功能号的数据帧，默认为0
	 * 其他的丢弃
	 */
	readonly functionNumber?: number;
}

/**
 * 线性插值重采样节点
 *
 * 不支持 BigInt 类型（U64/S64）的数据帧。
 */
export class Resampler extends CalculatorNode {
	private readonly targetRate: number;

	/** 上一帧最后一个样本值，用于跨帧插值边界 */
	private lastSample: number | null = null;
	/** 上一帧最后一个样本的时间戳（微秒） */
	private lastTimestamp: TimestampT | null = null;

	private readonly functionNumber: number;

	constructor(options: IOptions) {
		super(options.name);
		this.targetRate = options.targetRate ?? 512;
		this.functionNumber = options.functionNumber ?? 0;
	}

	override resume() {}

	override process(data: IDataFrame<TypeArray.Any>) {
		const { content, timestamp, rate, functionNumber } = data;
		if (functionNumber !== this.functionNumber) return;

		const targetRate = this.targetRate;

		const inputCount = content.length;
		if (inputCount === 0) return;

		const inputInterval = 1_000_000 / rate;
		const frameEndTs: TimestampT = timestamp + inputCount * inputInterval;
		const outputInterval = 1_000_000 / targetRate;
		const outputCount = Math.floor((frameEndTs - timestamp) / outputInterval);

		if (outputCount <= 0) {
			this.lastSample = content[inputCount - 1] as number;
			this.lastTimestamp = timestamp + (inputCount - 1) * inputInterval;
			return;
		}

		const Ctor = content.constructor as TypeArray.C;
		const output = new Ctor(outputCount);

		for (let i = 0; i < outputCount; i++) {
			const sampleTs: TimestampT = timestamp + i * outputInterval;
			// 在输入帧内的浮点索引
			const idx = (sampleTs - timestamp) / inputInterval;

			let value: number;
			if (idx <= 0) {
				// 需要跨帧插值：用上一帧末尾样本与当前帧首样本线性内插
				if (this.lastSample !== null && this.lastTimestamp !== null) {
					const t = this.lastTimestamp === timestamp ? 0 : (sampleTs - this.lastTimestamp) / (timestamp - this.lastTimestamp);
					value = this.lastSample + t * ((content[0] as number) - this.lastSample);
				} else {
					value = content[0] as number;
				}
			} else {
				const lo = Math.floor(idx);
				const hi = Math.min(lo + 1, inputCount - 1);
				const t = idx - lo;
				value = (content[lo] as number) * (1 - t) + (content[hi] as number) * t;
			}

			output[i] = value;
		}

		this.lastSample = content[inputCount - 1] as number;
		this.lastTimestamp = timestamp + (inputCount - 1) * inputInterval;

		this.emitData({
			content: output,
			timestamp,
			rate: targetRate,
			flow: data.flow,
			functionNumber,
		});
	}
}
application.adapters.registerNode(Resampler);

class ResamplerAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}
application.adapters.registerAdapter(ResamplerAdapter);
