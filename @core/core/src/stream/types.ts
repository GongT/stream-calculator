import type { EventRegister, IAsyncDisposable } from '@idlebox/common';
import type { Duplex, Readable, Writable } from 'node:stream';

export interface INodeStatus {
	sent: number;
	sentBytes: number;
	received: number;
	receivedBytes: number;
	error: number;
}

export type INode<R extends boolean | unknown = unknown, W extends boolean | unknown = unknown> = IBaseNode &
	(R extends true ? IRNode : {}) &
	(W extends true ? IWNode : {});

/** @internal */
export function privateStream<T extends Readable | Writable | Duplex>(node: INode): T {
	return (node as any).stream;
}

interface IBaseNode extends IAsyncDisposable {
	/**
	 * 用于日志输出的名称
	 */
	readonly displayName: string;
	/**
	 * 永久唯一标识
	 */
	readonly id: string;
	/**
	 * 运行时随机生成的唯一标识符
	 */
	readonly nodeGuid: string;
	/**
	 * 同类型第几个实例
	 */
	readonly serial: number;

	/**
	 * @internal 内部接口
	 */
	initialize(): Promise<void>;

	/**
	 * @internal 内部接口
	 */
	resume(): void;

	readonly onError: EventRegister<Error>;

	readonly statistic: Readonly<INodeStatus>;
}

/**
 * 表示该节点可能产生数据
 *
 * 例如传感器、计算器
 */
interface IRNode {
	readonly isSender: true;
	readonly targets: readonly INode[];

	pipeTo(node: INode<unknown, true>): typeof node;
}

/**
 * 表示该节点可以接收数据
 *
 * 例如计算器、记录器
 */
interface IWNode {
	readonly isReceiver: true;
	readonly sources: readonly INode[];
}
