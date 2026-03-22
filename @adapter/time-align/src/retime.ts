import { CalculatorNode } from '@core/core';
import type { IDataFrame, TypeArray } from '@core/protocol';
import { SoftwareDefectError } from '@idlebox/common';

interface IOptions {
	readonly name: string;
}

/**
 * 重定时器
 *
 * 记录数据流的第一个timestamp，随后所有timestamp以此为基准，根据数据长度重新计算
 */
export class ReTimer extends CalculatorNode<TypeArray.Any> {
	private readonly buffers = new Map<string /* node id */, Map<number /* function number */, Buffer>>();

	constructor(options: IOptions) {
		super(options.name);
	}

	override resume() {
		for (const source of this.sources) {
			this.buffers.set(source.nodeGuid, new Map());
		}
	}

	override async process(data: IDataFrame<TypeArray.Any>) {
		const map = this.buffers.get(nodeGuid);
		if (!map) {
			throw new SoftwareDefectError(`收到未知数据帧，flow = ${nodeGuid}`);
		}

		let buffer = map.get(data.functionNumber ?? 0);
		if (!buffer) {
			buffer = Buffer.alloc(0);
			map.set(data.functionNumber ?? 0, buffer);
		}
	}
}

class StreamConcat {
	
}

application.adapters.registerNode(ReTimer);
