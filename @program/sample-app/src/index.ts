import { FFT } from '@adapter/fft';
import { SensorNoise } from '@adapter/sensor-noise';
import { SensorSine } from '@adapter/sensor-sine';
import type { IAppHost } from '@core/core';

export async function startup(host: IAppHost) {
	host._register({
		dispose() {
			console.log('bye');
		},
	});

	const sensor1 = new SensorNoise({
		name: 'S1',
		sampleRate: 100000,
		genreateTimer: 300,
	});
	const sensor2 = new SensorSine({
		name: 'S2',
		frequency: 3,
		amplitude: 100,
		sampleRate: 100000,
		genreateTimer: 700,
	});

	// console.log(`sensor2:`, sensor2);

	// const resampler = new Resampler({
	// 	name: '1000Hz',
	// 	sampleRate: 1000,
	// })

	const fft = new FFT({ name: 'fft1' });

	// const alert = new ValueAlert({
	// 	name: '报警器',
	// 	validRange: [0.5, 1],
	// });
	// const fftRecord1 = new DatabaseWriter({
	// 	name: 'fft值1',
	// 	table: 'fft_noise',
	// 	options: {},
	// });
	// const fftRecord2 = new DatabaseWriter({
	// 	name: 'fft值2',
	// 	table: 'fft_sine',
	// 	options: {},
	// });
	// const rawRecord1 = new DatabaseWriter({
	// 	name: '噪声值',
	// 	table: 'raw_noise',
	// 	options: {},
	// });
	// const rawRecord2 = new DatabaseWriter({
	// 	name: '正弦值',
	// 	table: 'raw_sine',
	// 	options: {},
	// });

	sensor1.pipeTo(fft);
	sensor2.pipeTo(fft);

	// for (let i = 1; i <= 10; i++) {
	// 	const fft = new FFT({ name: `fft-x${i + 1}` });
	// 	const sensor = new SensorNoise({
	// 		name: `noise-x${i}`,
	// 		sampleRate: 100000,
	// 		genreateTimer: 300,
	// 	});

	// 	sensor.pipeTo(fft);
	// }
}
