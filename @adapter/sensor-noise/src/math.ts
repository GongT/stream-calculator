import { TypeArray } from '@core/protocol';

/**
 * 产生正弦波数据
 *
 * @param amplitude 振幅
 * @param durationMicro 生成片段的时长，单位微秒
 * @param sampleRate 采样率，单位Hz
 * @returns 生成的噪声数据
 */
export function generateNoiseSensorData(amplitude: number, durationMicro: number, sampleRate: number) {
	const totalSamples = Math.floor((durationMicro / 1000000) * sampleRate);
	const noiseData = new TypeArray.S32(totalSamples);

	const slice = sampleRate / 50; // 每 20ms 切换一次随机中心

	let randomCenter: number = 0;
	function reset() {
		randomCenter = Math.round((Math.random() * 2 - 1) * amplitude);
	}

	for (let i = 0; i < totalSamples; i++) {
		if (i % slice === 0) reset();
		noiseData[i] = randomCenter + Math.round((Math.random() * 2 - 1) * amplitude * 0.1);
	}

	return noiseData;
}
