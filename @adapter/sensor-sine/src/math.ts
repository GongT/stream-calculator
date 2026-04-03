import { TypeArray } from '@core/protocol';

/**
 * 预生成正弦波缓冲区（10个周期）
 *
 * @param frequency 频率，单位Hz
 * @param amplitude 振幅
 * @param sampleRate 采样率，单位Hz
 * @returns 包含10个周期的正弦波缓冲区
 */
export function createSineBuffer(frequency: number, amplitude: number, sampleRate: number) {
	const samplesPerCycle = sampleRate / frequency;
	const bufferSize = Math.round(samplesPerCycle * 10);
	const buffer = new TypeArray.S32(bufferSize);
	const angularFrequency = 2 * Math.PI * frequency;

	for (let i = 0; i < bufferSize; i++) {
		buffer[i] = Math.round(amplitude * Math.sin(angularFrequency * (i / sampleRate)));
	}

	return buffer;
}

/**
 * 从预生成缓冲区中按相位截取一段数据，避免每次申请内存
 *
 * @param buffer 预生成的正弦波缓冲区
 * @param sampleOffset 当前样本偏移量（不断递增，自动对缓冲区取模）
 * @param totalSamples 需要截取的样本数
 * @returns 截取的数据（无环绕时为零拷贝视图）
 */
export function sliceSineBuffer(buffer: InstanceType<typeof TypeArray.S32>, sampleOffset: number, totalSamples: number) {
	const bufferSize = buffer.length;
	const startSample = sampleOffset % bufferSize;
	const endSample = startSample + totalSamples;

	if (endSample <= bufferSize) {
		// 无环绕，零拷贝
		return buffer.subarray(startSample, endSample);
	}

	// 跨越缓冲区边界，需要拷贝
	const result = new TypeArray.S32(totalSamples);
	const firstPart = bufferSize - startSample;
	result.set(buffer.subarray(startSample), 0);
	result.set(buffer.subarray(0, totalSamples - firstPart), firstPart);
	return result;
}
