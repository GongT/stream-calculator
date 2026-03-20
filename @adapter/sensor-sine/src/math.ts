/**
 * 产生正弦波数据
 *
 * @param frequency 频率，单位Hz
 * @param phase 相位，单位弧度
 * @param amplitude 振幅
 * @param durationMs 生成片段的时长，单位毫秒
 * @param sampleRate 采样率，单位Hz
 * @returns 生成的正弦波数据
 */

export function generateSineSensorData(frequency: number, phase: number, amplitude: number, durationMs: number, sampleRate: number): Int32Array {
	const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
	const sineData = new Int32Array(totalSamples);
	const angularFrequency = 2 * Math.PI * frequency;

	for (let i = 0; i < totalSamples; i++) {
		const time = i / sampleRate;
		sineData[i] = Math.round(amplitude * Math.sin(angularFrequency * time + phase));
	}

	return sineData;
}
