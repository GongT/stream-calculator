// import { PassThrough } from 'node:stream';
// import { BaseNode } from './node.base.js';
// import type { IBaseStreamNode, IReadWriteStreamNode } from './types.js';

// /**
//  * @internal
//  */
// export class ForkNode extends BaseNode implements IReadWriteStreamNode {
// 	protected override expectDataType= Object as any;
// 	override readonly isSender = true;
// 	override readonly isReceiver = true;

// 	constructor(protected readonly children: readonly IBaseStreamNode[]) {
// 		super('');

// 		for (const child of children) {
// 			child.pipeTo(this);
// 		}
// 	}

// 	protected override __create_stream() {
// 		return new PassThrough({ objectMode: true });
// 	}

// 	protected override makeInfo() {
// 		return {
// 			id: `fork`,
// 			displayName: `Fork(${this.children.map((c) => c.displayName).join(', ')})`,
// 		};
// 	}
// }
