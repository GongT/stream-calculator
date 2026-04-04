import { Adapter, SensorNode } from '@core/core';
import type { TimestampT } from '@core/protocol';
import { TypeArray } from '@core/protocol';
import { Interval } from '@idlebox/common';
import { generateSineBuffer } from './math.js';

interface IOptions {
	readonly name: string;
	/**
	 * 频率，单位Hz
	 */
	readonly frequency: number;
	/**
	 * 振幅
	 */
	readonly amplitude?: number;
	/**
	 * 采样率，单位Hz，默认为 44100Hz
	 */
	readonly sampleRate?: number;
	/**
	 * 生成数据的时间间隔，单位微秒，但实际精度是毫秒
	 */
	readonly generateTimer?: number;
}

export class SensorSine extends SensorNode {
	private readonly sampleRate: number;
	private readonly intervalMs: number;
	private readonly sineBuffer: TypeArray.S32;
	private readonly samplesPerPeriod: number;

	private readonly timer;

	private previousMicroTime: TimestampT = Number(process.hrtime.bigint() / 1_000n);
	private phaseOffset: number = 0;

	constructor(options: IOptions) {
		super(options.name);

		this.sampleRate = options.sampleRate ?? 44100;
		this.intervalMs = Math.ceil((options.generateTimer ?? 1_000_000) / 1000);
		const amplitude = options.amplitude ?? 1;

		// 每个周期的采样点数（取整以保证缓冲区可被整除）
		this.samplesPerPeriod = Math.round(this.sampleRate / options.frequency);

		// 单次 tick 最大样点数（intervalMs 的 2 倍余量应对计时抖动）
		const maxSliceSamples = Math.ceil((this.intervalMs * this.sampleRate) / 1000) * 2;

		// 缓冲区大小：向上取整到完整周期，保证任意相位偏移 + 最大切片不越界
		const numPeriods = Math.ceil((this.samplesPerPeriod + maxSliceSamples) / this.samplesPerPeriod);
		this.sineBuffer = generateSineBuffer(amplitude, this.samplesPerPeriod, this.samplesPerPeriod * numPeriods);

		this.timer = this._register(new Interval(this.intervalMs));
		this.timer.onTick(this.timerTick.bind(this));
	}

	override resume() {
		this.logger.verbose`开始生成正弦波数据`;
		this.previousMicroTime = Number(process.hrtime.bigint() / 1_000n);
		this.timer.resume();
	}

	private timerTick() {
		const currentStartTime: TimestampT = Number(process.hrtime.bigint() / 1_000n);
		const elapsed = currentStartTime - this.previousMicroTime;
		const rawSliceSize = Math.floor((elapsed / 1_000_000) * this.sampleRate);
		if (rawSliceSize <= 0) return;
		// 防止计时器抖动超过2倍时溢出预分配缓冲区
		const maxAvailable = this.sineBuffer.length - this.phaseOffset;
		const sliceSize = Math.min(rawSliceSize, maxAvailable);
		const byteOffset = this.phaseOffset * 4;
		const data = new Int32Array(this.sineBuffer.buffer, byteOffset, sliceSize);

		// process.stderr.write(`currentStartTime = ${currentStartTime} | sliceSize=${sliceSize}\r`);

		this.previousMicroTime = currentStartTime;
		this.phaseOffset = (this.phaseOffset + sliceSize) % this.samplesPerPeriod;

		this.logger.verbose`产生了 ${data.length} 个数据，${data.byteLength} 字节，长度 ${elapsed / 1000}ms`;

		this.emitData({
			content: data,
			rate: this.sampleRate,
			timestamp: currentStartTime,
			functionNumber: 0,
		});
	}
}
application.adapters.registerNode(SensorSine);

class SensorSineAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}
application.adapters.registerAdapter(SensorSineAdapter);
