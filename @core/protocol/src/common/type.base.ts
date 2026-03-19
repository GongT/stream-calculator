import type { SupportedTypedArray } from './type.network.js';

/**
 * 基础类型定义，此定义仅用于nodejs程序，不涉及网络传输
 */
export type TimestampT = number;

/**
 * 数据帧
 */
export interface IDataFrame<T extends SupportedTypedArray = SupportedTypedArray> {
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
