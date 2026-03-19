import { FFTBandValue } from '@adapter/fft-band-value';
import { SensorSine } from '@adapter/sensor-sine';
import { startProcessing, type IAppHost } from '@core/core';

export async function startup(host: IAppHost) {
	host._register({
		dispose() {
			console.log('bye');
		},
	});

	// const sensor1 = new SensorNoise({
	// 	name: 'S1',
	// });
	const sensor2 = new SensorSine({
		name: 'S2',
		frequency: 3,
		amplitude: 100,
		sampleRate: 44100,
		genreateTimer: 700,
	});

	// console.log(`sensor2:`, sensor2);

	// const resampler = new Resampler({
	// 	name: '1000Hz',
	// 	sampleRate: 1000,
	// })

	const fft = new FFTBandValue({
		name: '计算',
		band: [490, 510],
	});

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

	// streamPipeline(sensor1, resampler, fft, [fftRecord1, alert]);
	// streamPipeline(sensor1, rawRecord1);

	// streamPipeline(sensor2, resampler, fft, [fftRecord2, alert]);
	// streamPipeline(sensor2, rawRecord2);
	// streamPipeline(sensor2, fft);

	sensor2.pipeTo(fft);

	startProcessing();
}
