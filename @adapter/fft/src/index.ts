import { Adapter, adapterHost, CalculatorNode } from '@core/core';
import { createProtocolSocket, type IDataFrame, type ProtocolStream } from '@core/protocol';
import { definePublicConstant, functionToDisposable } from '@idlebox/common';
import { getPython } from '@shared/testing';
import { execa } from 'execa';
import { resolve } from 'node:path';

interface IOptions {
	readonly name: string;
}

const spawnOptions = {
	stdio: ['pipe', 'pipe', 'inherit'],
	encoding: 'utf8',
} as const;

export class FFT extends CalculatorNode<Int32Array> {
	protected override expectDataType = Int32Array;

	private readonly communication!: ProtocolStream;
	private readonly name: string;

	constructor(options: IOptions) {
		super(options.name);

		this.name = options.name;
	}

	protected override async initialize() {
		const python = await getPython();
		const pyFile = resolve(import.meta.dirname, '../python/fft.py');

		const process = execa({ ...spawnOptions })`${python} ${pyFile}`;
		this._register(
			functionToDisposable(function killProcess() {
				process.kill();
			}),
		);

		const listenPort = await new Promise<number>((resolve, reject) => {
			process.on('error', reject);
			process.stdout.on('data', (data: string) => {
				resolve(Number.parseInt(data, 10));
			});
		});

		if (Number.isNaN(listenPort)) {
			throw new Error('fft.py没有输出一个有效的端口号');
		}

		const socket = await createProtocolSocket({
			address: `[::0]:${listenPort}`,
			agentName: `fft-server-${this.name}`,
			agentId: 0,
			type: 'udp',
		});
		definePublicConstant(this, 'communication', socket);
	}

	override process(data: IDataFrame<Int32Array>): void {}
}

adapterHost.addNode(FFT);

class FFTAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}

adapterHost.register(FFTAdapter);
