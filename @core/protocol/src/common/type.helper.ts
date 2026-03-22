import type { NetworkPacket } from '../networking/base.network.js';
import { Action } from '../networking/packet.decoupling.js';
import { DataPayload } from '../payloads/data-frame.payload.js';
import type { IDataFrame, TypeArray } from './type.base.js';

/**
 * 计算数据帧的持续时间
 *
 * 持续时间 = 数据长度（点数） / 采样率
 *
 * @param frame 数据帧
 * @returns 持续时间，单位为毫秒
 */
export function durationOf(frame: IDataFrame<TypeArray.Any>): number {
	return (1000 * frame.content.length) / frame.rate;
}

/**
 * 计算下一帧的起始时间戳
 *
 * 下一帧的起始时间戳 = 当前帧的起始时间戳 + 当前帧的持续时间
 *
 * @param frame 数据帧
 * @returns 时间戳，单位为毫秒
 */
export function timestampAfter(frame: IDataFrame<TypeArray.Any>): number {
	return frame.timestamp + durationOf(frame);
}

export function getPayloadFrameFromNetwork<T extends TypeArray.Any = TypeArray.Any>(
	packet: NetworkPacket,
	Type?: new (...args: any[]) => T,
): IDataFrame<T> {
	if (packet.action !== Action.DATA) {
		throw new Error(`getPayloadFrameFromNetwork只接受Action.DATA类型的包，当前包类型为${packet.action}`);
	}

	const payload = packet.payloadAs(DataPayload);

	return {
		content: payload.asTypedArray(Type),
		timestamp: payload.timestamp,
		rate: payload.rate,
		functionNumber: payload.func,
	};
}
