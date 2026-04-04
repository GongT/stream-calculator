import { FFT } from '@adapter/fft';
import { PublishWeb } from '@adapter/output-web';
import { Resampler } from '@adapter/resampler';
import { SensorNoise } from '@adapter/sensor-noise';
import { SensorSine } from '@adapter/sensor-sine';
import { createFrameAlign } from '@adapter/time-align';
import { WaveMerger } from '@adapter/wave-merge';

export async function startup() {
	const aligner = createFrameAlign('align');

	const sensor1 = aligner.wrap(
		new SensorNoise({
			name: 'S1',
			sampleRate: 100000,
			generateTimer: 80_000,
			amplitude: 100,
		}),
	);

	const sensor2 = aligner.wrap(
		new SensorSine({
			name: 'S2',
			frequency: 1.2345,
			amplitude: 500,
			sampleRate: 100000,
			generateTimer: 80_000,
		}),
	);

	const merge = new WaveMerger({
		name: 'm1',
		method: 'add',
	});

	const fft = new FFT({ name: 'fft1' });

	sensor2.pipeTo(merge);
	sensor1.pipeTo(merge);

	merge.pipeTo(fft);

	const pub1 = new PublishWeb({
		guid: '2f4e73a4-5c74-4dab-bb6a-6cc8a8f9eeb1',
		name: `sensor1`,
	});

	const r1 = new Resampler({ name: 'raw', targetRate: 500 });
	merge.pipeTo(r1);
	r1.pipeTo(pub1);

	const r2 = new Resampler({ name: 'fft1', targetRate: 500, functionNumber: 1 });
	fft.pipeTo(r2);
	r2.pipeTo(pub1);

	const r3 = new Resampler({ name: 'fft2', targetRate: 500, functionNumber: 2 });
	fft.pipeTo(r3);
	r3.pipeTo(pub1);
}
