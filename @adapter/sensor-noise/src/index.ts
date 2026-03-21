import { Adapter, adapterHost, SendorNode } from '@core/core';
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
	 * 生成数据的时间间隔，单位毫秒
	 */
	readonly genreateTimer?: number;
}

export class SensorNoise extends SendorNode {
	protected override expectDataType = Int32Array;

	private readonly amplitude: number;
	private readonly sampleRate: number;

	private readonly timer;
	private readonly intervalMs: number;

	private previousTime: number = Date.now();

	constructor(options: IOptions) {
		super(options.name);

		this.amplitude = options.amplitude ?? 1;
		this.sampleRate = options.sampleRate ?? 44100;
		this.intervalMs = options.genreateTimer ?? 1000;

		this.timer = new Interval(this.intervalMs);
		this.timer.onTick(this.timerTick.bind(this));
	}

	override resume() {
		this.logger.verbose`开始生成噪声数据`;
		this.timer.resume();
	}

	private timerTick() {
		const currentStartTime = Date.now();
		const elapsed = currentStartTime - this.previousTime;

		const data = generateNoiseSensorData(this.amplitude, elapsed, this.sampleRate);

		this.previousTime = currentStartTime;

		this.logger.verbose`产生了 ${data.length} 个数据，${data.byteLength} 字节，长度 ${elapsed}ms`;

		this.emitData({
			content: data,
			rate: this.sampleRate,
			timestamp: currentStartTime,
			functionNumber: 0,
		});
	}
}
adapterHost.registerNode(SensorNoise);

class SensorNoiseAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}
adapterHost.registerAdapter(SensorNoiseAdapter);
