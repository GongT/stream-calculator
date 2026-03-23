import type { TypeArray } from "@core/protocol";

/**
 * 计算指定采样率下，一段时间的数据点数量
 *
 * @param delta 时间间隔，单位微秒
 * @param rate 采样频率，单位Hz
 * @returns 数据点数量
 */
export function calculateDataPoints(delta: number, rate: number): number {
	return Math.floor(delta * (rate / 1_000_000));
}

/**
 * 计算指定采样率下，数据点数量对应的时间间隔
 *
 * @param dataPoints 数据点数量
 * @param rate 采样频率，单位Hz
 * @returns 时间间隔，单位微秒，不一定是整数
 */
export function calculateTimeDelta(dataPoints: number, rate: number): number {
	return (dataPoints / rate) * 1_000_000;
}

/**
 * 计算最后一个数据点所在的时间戳
 *
 * @param startTime 起始时间，单位微秒
 * @param dataPoints 数据点数量
 * @param rate 采样频率，单位Hz
 * @returns 最后一个数据点的时间戳，单位微秒，不一定是整数
 */
export function calculateLastTimestamp(startTime: number, dataPoints: number, rate: number): number {
	const timeDelta = calculateTimeDelta(dataPoints, rate);
	return startTime + timeDelta;
}

/**
 * 判断数据对应微秒数是否为整数
 * @param dataPoints 数据点数量
 * @param rate 采样频率，单位Hz
 * @returns 数据对应的微秒数是否为整数
 *
 * @example
 * isDataFrameComplete(123, 10) // true，12.3秒的数据
 * isDataFrameComplete(44100, 44100) // true，1秒的数据
 * isDataFrameComplete(44101, 44100)  // false，约1.0000227秒的数据
 * isDataFrameComplete(22050, 44100) // true，0.5秒的数据
 * isDataFrameComplete(1, 44100) // false，约22.7微秒的数据
 */
export function isDataFrameAlign(dataPoints: number, rate: number): boolean {
	const timeDelta = calculateTimeDelta(dataPoints, rate);
	return Number.isInteger(timeDelta);
}

/**
 * 计算指定采样率下，一段时间的数据对应的字节数
 * 
 * @param rate 采样频率，单位Hz
 * @param content 数据内容类型（值不需要）
 * @param duration 时间间隔，单位微秒
 * @returns 数据对应的字节数
 */
export function calculateBytes(rate: number, content: TypeArray.C, duration: number): number {
	const dataPoints = calculateDataPoints(duration, rate);
	const bytesPerPoint = content.BYTES_PER_ELEMENT;
	return dataPoints * bytesPerPoint;
}
