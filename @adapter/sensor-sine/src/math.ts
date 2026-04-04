import { TypeArray } from '@core/protocol';

export function generateSineBuffer(amplitude: number, samplesPerPeriod: number, totalSamples: number): TypeArray.S32 {
	const buffer = new TypeArray.S32(totalSamples);

	for (let i = 0; i < totalSamples; i++) {
		buffer[i] = Math.round(amplitude * Math.sin((2 * Math.PI * i) / samplesPerPeriod));
	}

	return buffer;
}
