/**
 * @internal
 */
export interface IBaseStreamNode {
	readonly displayName: string;
	readonly id: string;
	readonly serial: number;

	/**
	 * 表示该节点可以接收数据
	 *
	 * 例如计算器、记录器
	 */
	readonly isReceiver: boolean;

	/**
	 * 表示该节点可能产生数据
	 *
	 * 例如传感器、计算器
	 */
	readonly isSender: boolean;

	pipeTo(node1: IBaseStreamNode, ...nodes: IBaseStreamNode[]): typeof node1;
}

export interface IReadableStreamNode extends IBaseStreamNode {
	readonly isSender: true;
}
export interface IWritableStreamNode extends IBaseStreamNode {
	readonly isReceiver: true;
}

export interface IReadWriteStreamNode extends IReadableStreamNode, IWritableStreamNode {
	readonly isSender: true;
	readonly isReceiver: true;
}
