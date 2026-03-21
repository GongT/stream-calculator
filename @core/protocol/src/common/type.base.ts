import * as _TypeArray from '../_internal/type.array.js';

export { _TypeArray as TypeArray };

/**
 * 基础类型定义，此定义仅用于nodejs程序，不涉及网络传输
 */
export type TimestampT = number;

/**
 * 数据帧
 */
export interface IDataFrame<T extends _TypeArray.Any = _TypeArray.Any> {
	/**
	 * 数据
	 */
	readonly content: T;
	/**
	 * 数据起点时间戳，单位为毫秒
	 */
	readonly timestamp: TimestampT;
	/**
	 * 数据采样率
	 */
	readonly rate: number;
	/**
	 * 功能编号，可选，默认为0
	 */
	functionNumber?: number;
}
