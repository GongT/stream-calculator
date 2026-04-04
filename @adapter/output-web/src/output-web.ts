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

	constructor(public readonly path: string) {
		super('stream');
	}

	publish(data: IDataFrame) {
		const payload = new DataPayload(data);
		const binary = payload.encodeLocalEndian();
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

export class PublishWeb extends FinalizedNode<TypeArray.S32> {
	public readonly guid: string;
	private declare publisher: PublishServer;

	constructor(options: IOptions) {
		super(options.name);
		this.guid = options.guid;

		streams.set(this.guid, this);
		streamIdToNameMap.set(this.guid, options.name);
	}

	protected override async _initialize() {
		this.publisher = new PublishServer(this.guid);
		application.api.provideWebsocket(this.publisher);
	}

	override async process(data: IDataFrame<TypeArray.S32>) {
		this.publisher.publish(data);
	}
}

application.adapters.registerNode(PublishWeb);

class PublishAdapter extends Adapter {
	public override activate(): void | Promise<void> {
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
