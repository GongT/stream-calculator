import { Adapter, FinalizedNode, WebSocketEndpoint } from '@core/core';
import type { IDataFrame, TypeArray } from '@core/protocol';
import type WebSocket from 'ws';

interface IOptions {
	readonly name: string;
	readonly guid: string;
}

class PublishServer extends WebSocketEndpoint {
	override async connection(socket: WebSocket) {
		socket.send(Buffer.from('Hello, WebSocket!'));
	}
}

export class PublishWeb extends FinalizedNode<TypeArray.S32> {
	public readonly guid: string;

	constructor(options: IOptions) {
		super(options.name);
		this.guid = options.guid;
	}

	protected override async _initialize() {
		application.api.provideWebsocket('example-publisher', PublishServer);
	}

	override async process(_data: IDataFrame<TypeArray.S32>) {}
}

application.adapters.registerNode(PublishWeb);

class PublishAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}

application.adapters.registerAdapter(PublishAdapter);
