import { PublishWeb } from '@adapter/output-web';
import { SensorNoise } from '@adapter/sensor-noise';

export async function startup() {
	// const wave = new SensorSine({
	// 	name: 'gen',
	// 	frequency: 0.51268,
	// 	amplitude: 400,
	// 	sampleRate: 100,
	// 	generateTimer: 300_000,
	// });
	const wave = new SensorNoise({
		name: 'gen',
		amplitude: 50,
		sampleRate: 100,
		generateTimer: 10_000,
	});

	const pub1 = new PublishWeb({
		guid: '2f4e73a4-5c74-4dab-bb6a-6cc8a8f9eeb1',
		name: `sensor1`,
	});

	// const r1 = new Resampler({ name: 'r1', targetRate: 500 });
	// sine.pipeTo(r1);

	wave.pipeTo(pub1);
}
