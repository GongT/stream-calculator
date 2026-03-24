import { Adapter, SendorNode } from '@core/core';
import { Interval } from '@idlebox/common';
import { generateNoiseSensorData } from './math.js';

interface IOptions {
	readonly name: string;
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

export class SensorNoise extends SendorNode {
	private readonly amplitude: number;
	private readonly sampleRate: number;

	private readonly timer;
	private readonly intervalMs: number;

	private previousMicroTime: number = Number(process.hrtime.bigint() / 1000n);

	constructor(options: IOptions) {
		super(options.name);

		this.amplitude = options.amplitude ?? 1;
		this.sampleRate = options.sampleRate ?? 44100;
		this.intervalMs = Math.ceil((options.genreateTimer ?? 1000000) / 1000);

		this.timer = this._register(new Interval(this.intervalMs));
		this.timer.onTick(this.timerTick.bind(this));
	}

	override resume() {
		this.logger.verbose`开始生成噪声数据`;
		this.timer.resume();
	}

	private timerTick() {
		const currentStartTime = Number(process.hrtime.bigint() / 1000n);
		const elapsed = currentStartTime - this.previousMicroTime;

		const data = generateNoiseSensorData(this.amplitude, elapsed, this.sampleRate);

		this.previousMicroTime = currentStartTime;

		this.logger.verbose`产生了 ${data.length} 个数据，${data.byteLength} 字节，长度 ${elapsed / 1000}ms`;

		this.emitData({
			content: data,
			rate: this.sampleRate,
			timestamp: currentStartTime,
			functionNumber: 0,
		});
	}
}
application.adapters.registerNode(SensorNoise);

class SensorNoiseAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}
application.adapters.registerAdapter(SensorNoiseAdapter);
