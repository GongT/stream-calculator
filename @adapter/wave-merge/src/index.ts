import { Adapter, CalculatorNode, JsonReader } from '@core/core';
import { DataPayload, type IDataFrame, type ProtocolStream, type TypeArray } from '@core/protocol';
import { definePublicConstant, SoftwareDefectError } from '@idlebox/common';
import { getPython } from '@shared/testing';

interface IOptions {
	readonly name: string;
	/**
	 *
	 */
	readonly method: 'add';
	/**
	 * 只关注指定 functionNumber 的包，其他包直接丢弃
	 * 默认为0
	 */
	readonly functionNumber?: number;
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

/**
 * 波形合并器
 *
 * 将多个已经对齐的数据流合并成一个数据流输出
 *
 * 不做对齐、长度、类型的检查
 *
 * 此节点仅读取指定 functionNumber 的包，其他包直接丢弃
 */
export class WaveMerger extends CalculatorNode<TypeArray.Any> {
	protected readonly communication!: ProtocolStream;
	private readonly method: string;
	private readonly functionNumber: number;

	constructor(options: IOptions) {
		super(options.name);

		this.method = options.method;
		this.functionNumber = options.functionNumber ?? 0;
	}

	protected override async _initialize() {
		const python = await getPython();

		const args = ['-m', 'my_programs.wave_merger.server', '--size', this.sources.length.toFixed(0), '--method', this.method];

		const process = this.spawnWorker([python, ...args], spawnOptions);
		const outputReader = this._register(new JsonReader(process.stdout));

		const { port } = await outputReader.waitFor((data): data is IListen => {
			return data.type === 'listen';
		});

		this.logger.success`发现服务器端口: ${port}`;

		console.log(this.displayName);
		const socket = await this.createProtocolSocket({
			address: `[::1]:${port}`,
			agentName: `wave-merge-server-${this.name}`,
			agentId: this.serial,
		});
		definePublicConstant(this, 'communication', socket);

		await socket.sendKeepAlive();

		this.logger.success`握手成功`;

		socket.onNetworkPacket((packet) => {
			const dataFrame = packet.payloadAs(DataPayload);
			dataFrame.func = this.functionNumber;
			this.emitData({
				...dataFrame,
				content: dataFrame.asTypedArray(),
			});
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

		if (data.functionNumber !== this.functionNumber) {
			this.logger.verbose`skip function number ${data.functionNumber} from ${srcNodeId}`;
			return;
		}
		const order = this.orderMap[srcNodeId];
		const prevNode = this.sources[order];
		if (!prevNode) {
			this.logger.error`无法找到数据来源节点: ${srcNodeId}list<${this.sources.map((s) => s.nodeGuid)}>`;
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
