import { Adapter, CalculatorNode, JsonReader } from '@core/core';
import { createProtocolSocket, DataPayload, TypeArray, type IDataFrame, type ProtocolStream } from '@core/protocol';
import { definePublicConstant, SoftwareDefectError } from '@idlebox/common';
import { getPython } from '@shared/testing';

interface IOptions {
	readonly name: string;
	readonly dataType: new () => TypeArray.Any;

	/**
	 *
	 */
	readonly method: 'add';
	/**
	 * 缓冲时间（毫秒），超过这个时间没有将所有输入收集齐，就产生错误
	 * 默认10秒，最小1秒
	 */
	readonly bufferLength?: number;
}

const spawnOptions = {
	// stdio: ['pipe', 'pipe', 'inherit'],
	stdin: 'pipe',
	stdout: 'pipe',
	stderr: 'inherit',
	encoding: 'utf8',
} as const;

interface IListen {
	type: 'listen';
	port: number;
}

export class WaveMerger extends CalculatorNode<TypeArray.Any> {
	protected readonly expectDataType;

	protected readonly communication!: ProtocolStream;
	private readonly name: string;
	private readonly method: string;
	private readonly bufferLength: number;

	constructor(options: IOptions) {
		super(options.name);

		this.expectDataType = options.dataType;
		this.name = options.name;
		this.method = options.method;
		this.bufferLength = options.bufferLength ?? 10000;
	}

	protected override async initialize() {
		const python = await getPython();

		const args = [
			'-m',
			'my_programs.wave_merger.server',
			'--size',
			this.sources.length.toFixed(0),
			'--method',
			this.method,
			'--buffer-length',
			this.bufferLength.toFixed(0),
		];

		const process = this.spawnWorker([python, ...args], spawnOptions);
		const outputReader = this._register(new JsonReader(process.stdout));

		const { port } = await outputReader.waitFor((data): data is IListen => {
			return data.type === 'listen';
		});

		this.logger.success`发现服务器端口: ${port}`;

		const socket = await createProtocolSocket({
			address: `[::1]:${port}`,
			agentName: `wave-merge-server-${this.name}`,
			agentId: 0,
		});
		definePublicConstant(this, 'communication', socket);

		await socket.sendKeepAlive();

		this.logger.success`握手成功`;

		socket.onNetworkPacket((packet) => {
			this.emitData(packet.payloadAs(DataPayload));
		});
	}

	private orderMap: Record<string, number> = {};
	override resume() {
		for (const [index, src] of this.sources.entries()) {
			this.orderMap[src.nodeGuid] = index;
		}
	}

	override async process(data: IDataFrame<TypeArray.S32>) {
		const srcNodeId = data.flow?.at(-1);
		if (!srcNodeId) {
			this.logger.error`数据来源节点信息丢失: ${data}`;
			throw new SoftwareDefectError('数据来源节点信息丢失');
		}

		if (data.functionNumber) {
			this.logger.verbose`skip function number ${data.functionNumber} from ${srcNodeId}`;
			this.emitData(data);
			return;
		}
		const order = this.orderMap[srcNodeId];
		const prevNode = this.sources[order];
		if (!prevNode) {
			this.logger.error`无法找到数据来源节点: ${srcNodeId}`;
			throw new SoftwareDefectError(`无法找到数据来源节点: ${srcNodeId}`);
		}

		data.functionNumber = order;

		this.logger.verbose`接收到上级输入数据，长度为${data.content.length}，来自${prevNode.displayName}，分配的顺序号为${order}`;
		await this.communication.sendDataFrame(data);
	}
}

application.adapters.registerNode(WaveMerger);

class WaveMergerAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}

application.adapters.registerAdapter(WaveMergerAdapter);
