import { Adapter, FinalizedNode, WebSocketEndpoint, z } from '@core/core';
import { DataPayload, type IDataFrame, type TypeArray } from '@core/protocol';
import type WebSocket from 'ws';

interface IOptions {
	readonly name: string;
	readonly guid: string;
}

const streamIdToNameMap = new Map<string, string>();
const streams = new Map<string, PublishWeb>();

class PublishServer extends WebSocketEndpoint {
	private readonly streams: WebSocket[] = [];

	constructor() {
		super('stream');
	}

	publish(data: IDataFrame) {
		const payload = new DataPayload(data);
		const binary = payload.encode();
		for (const socket of this.streams) {
			socket.send(binary);
		}
	}

	override async connection(socket: WebSocket) {
		this.streams.push(socket);

		await new Promise((resolve) => socket.on('close', resolve));

		this.streams.splice(this.streams.indexOf(socket), 1);
	}
}
const publisher = new PublishServer();

export class PublishWeb extends FinalizedNode<TypeArray.S32> {
	public readonly guid: string;

	constructor(options: IOptions) {
		super(options.name);
		this.guid = options.guid;

		streams.set(this.guid, this);
		streamIdToNameMap.set(this.guid, options.name);
	}

	protected override async _initialize() {}

	override async process(data: IDataFrame<TypeArray.S32>) {
		publisher.publish(data);
	}
}

application.adapters.registerNode(PublishWeb);

class PublishAdapter extends Adapter {
	public override activate(): void | Promise<void> {
		application.api.provideWebsocket('stream-publisher', publisher);

		application.api.provideJsonApi({
			displayName: '列出所有流',
			path: 'stream-list',
			async handle() {
				return {
					list: streamIdToNameMap,
				};
			},
			input: z.strictObject({}),
			output: z.strictObject({
				list: z.map(z.string(), z.string()),
			}),
		});
	}
}

application.adapters.registerAdapter(PublishAdapter);
