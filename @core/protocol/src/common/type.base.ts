import * as _TypeArray from '../_internal/type.array.js';

export { _TypeArray as TypeArray };

/**
 * 时间戳类型，单位为微秒
 */
export type TimestampT = number;

export interface IWithType {
	readonly type: string;
}

/**
 * 数据帧
 */
export interface IDataFrame<T = _TypeArray.Any> {
	/**
	 * 数据
	 */
	content: T;
	/**
	 * 数据起点时间戳，单位为微秒
	 */
	timestamp: TimestampT;
	/**
	 * 数据采样率
	 */
	rate: number;
	/**
	 * 功能编号，默认为0
	 * 各个节点随意使用
	 *
	 * 不要设置成负数，可能造成意外结果
	 */
	functionNumber?: number;

	/**
	 * 数据包流动顺序
	 * 每个元素表示数据包经过的节点ID
	 *
	 * 这个字段【不会】出现在网络传输中
	 */
	readonly flow?: readonly string[];

	/**
	 * 元数据，可以携带任意数据
	 *
	 * 这个字段【不会】出现在网络传输中，和NetworkPacket中的同名字段完全无关
	 *
	 * 隐藏字段，系统内部处理
	 */
	// metadata?: IWithType;
}
