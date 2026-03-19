import { BaseNode } from './node.base.js';

// const isArray: (arg: any) => arg is ReadonlyArray<IBaseStreamNode> = Array.isArray;

// export function streamPipeline(...nodes: Array<IBaseStreamNode | ReadonlyArray<IBaseStreamNode>>) {
// 	let current: IBaseStreamNode | null = null;
// 	for (const node of nodes) {
// 		if (isArray(node)) {
// 			const dup = new ForkNode(node);

// 			if (current) {
// 				current.pipeTo(dup);
// 			}
// 			current = dup;
// 		} else {
// 			if (current) {
// 				current.pipeTo(node);
// 			}
// 			current = node;
// 		}
// 	}
// }

export async function startProcessing() {
	for (const node of await BaseNode.getAllInstances()) {
		node.resume();
	}
}
