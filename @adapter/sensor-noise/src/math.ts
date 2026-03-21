import { TypeArray } from '@core/protocol';

/**
 * 产生正弦波数据
 *
 * @param amplitude 振幅
 * @param durationMs 生成片段的时长，单位毫秒
 * @param sampleRate 采样率，单位Hz
 * @returns 生成的噪声数据
 */
export function generateNoiseSensorData(amplitude: number, durationMs: number, sampleRate: number) {
	const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
	const noiseData = new TypeArray.S32(totalSamples);

	for (let i = 0; i < totalSamples; i++) {
		noiseData[i] = Math.round((Math.random() * 2 - 1) * amplitude);
	}

	return noiseData;
}
