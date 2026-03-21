import { Adapter, adapterHost, CalculatorNode, LineReader } from '@core/core';
import { assertArrayType, createProtocolSocket, TypeArray, type IDataFrame, type ProtocolStream } from '@core/protocol';
import { definePublicConstant } from '@idlebox/common';
import { getPython } from '@shared/testing';
import { resolve } from 'node:path';

interface IOptions {
	readonly name: string;
}

const spawnOptions = {
	// stdio: ['pipe', 'pipe', 'inherit'],
	stdin: 'pipe',
	stdout: 'pipe',
	stderr: 'inherit',
	encoding: 'utf8',
} as const;

export class FFT extends CalculatorNode<TypeArray.S32> {
	protected override expectDataType = TypeArray.S32;

	protected readonly communication!: ProtocolStream;
	private readonly name: string;

	constructor(options: IOptions) {
		super(options.name);

		this.name = options.name;
	}

	protected override async initialize() {
		const python = await getPython();
		const args = resolve('-m', 'my_programs.fft.spectrum.server');

		const process = this.spawnWorker([python, ...args], spawnOptions);
		const outputReader = this._register(new LineReader(process.stdout));

		const listenPortStr = await outputReader.waitFor((line) => line.length > 0);
		const listenPort = Number.parseInt(listenPortStr, 10);
		if (Number.isNaN(listenPort)) {
			throw new Error('py没有立即输出一个有效的端口号');
		}

		this.logger.success`发现服务器端口: ${listenPort}`;

		const socket = await createProtocolSocket({
			address: `[::1]:${listenPort}`,
			agentName: `fft-server-${this.name}`,
			agentId: 0,
		});
		definePublicConstant(this, 'communication', socket);

		socket.onDataFrame((dataFrame) => {
			this.logger.verbose`收到FFT服务器算好的数据，共${dataFrame.content.byteLength}字节`;
			assertArrayType(dataFrame, TypeArray.S32);
			this.emitData(dataFrame);
		});
	}

	override async process(data: IDataFrame<TypeArray.S32>) {
		this.logger.verbose`接收到上级输入数据，长度为${data.content.length}`;
		await this.communication.sendDataFrame(data);
	}
}

adapterHost.registerNode(FFT);

class FFTAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}

adapterHost.registerAdapter(FFTAdapter);
