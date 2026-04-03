import type { IDataFrame } from '@core/protocol';
import type { Readable, Writable } from 'node:stream';
import { AbstractNode } from './node.abstract.js';
import type { INode } from './types.js';

/** @internal */
export type RS = {
	readonly stream: Readable;
	readonly _targets: INode<unknown, true>[];
};

/** @internal */
export type WS = {
	readonly stream: Writable;
	readonly _sources: INode<true, unknown>[];
};

/** @internal */
export function isWritableNode(node: INode): node is INode<unknown, true> & WS {
	return node instanceof AbstractNode && node.isReceiver;
}

/** @internal */
export interface IStreamObject<T> {
	readonly frame: IDataFrame<T>;
	readonly metadata?: any;
}
