import { Adapter, adapterHost, CalculatorNode, LineReader } from '@core/core';
import { createProtocolSocket, DataPayload, TypeArray, type IDataFrame, type ProtocolStream } from '@core/protocol';
import { definePublicConstant } from '@idlebox/common';
import { getPython } from '@shared/testing';

interface IOptions {
	readonly name: string;
	readonly magnitudeScale?: number;
	readonly phaseScale?: number;
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
	private readonly mScale: number;
	private readonly pScale: number;

	constructor(options: IOptions) {
		super(options.name);

		this.name = options.name;
		this.mScale = options.magnitudeScale ?? 10;
		this.pScale = options.phaseScale ?? 1000;
	}

	protected override async initialize() {
		const python = await getPython();
		const args = ['-m', 'my_programs.fft.spectrum.server', '--magnitude-scale', this.mScale.toFixed(2), '--phase-scale', this.pScale.toFixed(2)];

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

		await socket.sendKeepAlive();

		this.logger.success`握手成功`;

		socket.onNetworkPacket((packet) => {
			const dataFrame = packet.payloadAs(DataPayload);
			switch (dataFrame.func) {
				case 1: // 频谱数据
					this.logger.verbose`收到频谱数据，共${dataFrame.content.byteLength}字节`;
					dataFrame.asTypedArray(TypeArray.S32);
					break;
				case 2: // 相位数据
					this.logger.verbose`收到相位数据，共${dataFrame.content.byteLength}字节`;
					dataFrame.asTypedArray(TypeArray.S32);
					break;
				default:
					this.logger.warn`收到未知功能号的数据帧: ${dataFrame.func}`;
			}
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
