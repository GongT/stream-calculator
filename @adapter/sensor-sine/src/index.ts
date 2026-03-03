export function generateSineSensorData(frequency: number, amplitude: number, sampleRate: number, durationMs: number): Uint32Array {
	const sampleCount = Math.floor(sampleRate * (durationMs / 1000));
	const data = new Uint32Array(sampleCount);

	for (let i = 0; i < sampleCount; i++) {
		const time = i / sampleRate;
		const value = Math.round((Math.sin(2 * Math.PI * frequency * time) + 1) / 2 * amplitude);
		data[i] = value;
	}

	return data;
}


export function entry(host: AdapterHost) {

}
