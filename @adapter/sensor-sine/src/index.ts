import { Adapter, SendorNode } from '@core/core';
import { Interval } from '@idlebox/common';
import { createSineBuffer, sliceSineBuffer } from './math.js';

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
	readonly genreateTimer?: number;
}

export class SensorSine extends SendorNode {
	private readonly frequency: number;
	private readonly amplitude: number;
	private readonly sampleRate: number;

	private readonly timer;
	private readonly intervalMs: number;
	private readonly sineBuffer;

	private previousTime: number = Number(process.hrtime.bigint() / 1000n);
	private sampleOffset = 0;

	constructor(options: IOptions) {
		super(options.name);

		this.frequency = options.frequency;
		this.amplitude = options.amplitude ?? 1;
		this.sampleRate = options.sampleRate ?? 44100;
		this.intervalMs = Math.ceil((options.genreateTimer ?? 1_000_000) / 1000);

		this.sineBuffer = createSineBuffer(this.frequency, this.amplitude, this.sampleRate);

		this.timer = this._register(new Interval(this.intervalMs));
		this.timer.onTick(this.timerTick.bind(this));
	}

	override resume() {
		this.logger.verbose`开始生成正弦波数据`;
		this.timer.resume();
	}

	private timerTick() {
		const currentStartTime = Number(process.hrtime.bigint() / 1000n);
		const elapsed = currentStartTime - this.previousTime;

		const totalSamples = Math.floor((elapsed / 1_000_000) * this.sampleRate);
		const data = sliceSineBuffer(this.sineBuffer, this.sampleOffset, totalSamples);

		this.previousTime = currentStartTime;
		this.sampleOffset += totalSamples;

		this.logger
			.verbose`产生了 ${data.length} 个数据，${data.byteLength} 字节，长度 ${elapsed / 1000}ms，样本偏移=${this.sampleOffset}`;

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
