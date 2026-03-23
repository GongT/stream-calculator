import { TypeArray } from '@core/protocol';

/**
 * 产生正弦波数据
 *
 * @param frequency 频率，单位Hz
 * @param phase 相位，单位弧度
 * @param amplitude 振幅
	* @param durationMicro 生成片段的时长，单位微秒
 * @param sampleRate 采样率，单位Hz
 * @returns 生成的正弦波数据
 */
export function generateSineSensorData(frequency: number, phase: number, amplitude: number, durationMicro: number, sampleRate: number) {
	const totalSamples = Math.floor((durationMicro / 1_000_000) * sampleRate);
	const sineData = new TypeArray.S32(totalSamples);
	const angularFrequency = 2 * Math.PI * frequency;

	for (let i = 0; i < totalSamples; i++) {
		const time = i / sampleRate;
		sineData[i] = Math.round(amplitude * Math.sin(angularFrequency * time + phase));
	}

	return sineData;
}
