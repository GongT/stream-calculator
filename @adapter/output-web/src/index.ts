import { Adapter, CalculatorNode } from '@core/core';
import type { IDataFrame, TypeArray } from '@core/protocol';

interface IOptions {
	readonly name: string;
	readonly guid: string;
}

export class PublishWeb extends CalculatorNode<TypeArray.S32> {
	public readonly guid: string;

	constructor(options: IOptions) {
		super(options.name);
		this.guid = options.guid;
	}

	protected override async _initialize() {}

	override async process(_data: IDataFrame<TypeArray.S32>) {}
}

application.adapters.registerNode(PublishWeb);

class PublishAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}

application.adapters.registerAdapter(PublishAdapter);
