import { Adapter, SendorNode } from '@core/core';
import { Interval } from '@idlebox/common';
import { generateSineSensorData } from './math.js';

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

	private previousTime: number = Number(process.hrtime.bigint() / 1000n);
	private previousPhase = 0;

	constructor(options: IOptions) {
		super(options.name);

		this.frequency = options.frequency;
		this.amplitude = options.amplitude ?? 1;
		this.sampleRate = options.sampleRate ?? 44100;
		this.intervalMs = Math.ceil((options.genreateTimer ?? 1_000_000) / 1000);

		this.timer = new Interval(this.intervalMs);
		this.timer.onTick(this.timerTick.bind(this));
	}

	override resume() {
		this.logger.verbose`开始生成正弦波数据`;
		this.timer.resume();
	}

	private timerTick() {
		const currentStartTime = Number(process.hrtime.bigint() / 1000n);
		const elapsed = currentStartTime - this.previousTime;

		const data = generateSineSensorData(this.frequency, this.previousPhase, this.amplitude, elapsed, this.sampleRate);

		this.previousTime = currentStartTime;

		// Update the phase based on the elapsed time and frequency
		const phaseIncrement = (2 * Math.PI * this.frequency * elapsed) / 1_000_000;
		this.previousPhase = (this.previousPhase + phaseIncrement) % (2 * Math.PI);

		this.logger
			.verbose`产生了 ${data.length} 个数据，${data.byteLength} 字节，长度 ${elapsed / 1000}ms，相位+${phaseIncrement.toFixed(0)}=${this.previousPhase.toFixed(2)}`;

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
