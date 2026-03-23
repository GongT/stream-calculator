import { CalculatorNode } from '@core/core';
import type { IDataFrame, TimestampT, TypeArray } from '@core/protocol';
import assert from 'node:assert';

export function createFrameAlign(name: string) {
	const controller = new FrameAlignController();

	return () =>
		new FrameAlign({
			name,
			controller,
		});
}

class FrameAlignController {
	private readonly callbacks = new Map<string /* node id */, (time: TimestampT) => void>();
	private initialized = new Set<string /* node id */>();
	private latest: TimestampT = 0;

	awaiting(guid: string, callback: (time: TimestampT) => void) {
		this.callbacks.set(guid, callback);
	}

	initialize(guid: string, time: TimestampT) {
		this.initialized.add(guid);
		this.latest = Math.max(this.latest, time);

		if (this.initialized.size === this.callbacks.size) {
			this.flush();
		}
	}

	private flush() {
		for (const callback of this.callbacks.values()) {
			callback(this.latest);
		}
		this.callbacks.clear();
		this.initialized.clear();
	}
}

interface IOptions {
	readonly name: string;
	/**
	 * 对齐控制器
	 */
	readonly controller: FrameAlignController;
}

/**
 * 多流时间对齐
 *
 * 此节点只允许一个输入源
 * 仅处理functionNumber=0的流，其他的直接原样输出（没有对齐功能）
 *
 * 不是把多个流pipe到一起，是通过controller来控制每个流（中的 FrameAlign ）进行对齐
 */
class FrameAlign extends CalculatorNode<TypeArray.Any> {
	private readonly controller: FrameAlignController;
	private readonly buffers: IDataFrame[] = [];

	constructor(options: IOptions) {
		super(options.name);

		this.controller = options.controller;
		this.controller.awaiting(this.nodeGuid, this.align.bind(this));
	}

	override resume() {
		this.assertSingleInput();
	}

	override process(data: IDataFrame<TypeArray.Any>) {
		if (data.functionNumber !== 0) {
			return this.emitData(data);
		}

		this.buffers.push(data);
		if (this.buffers.length > 50) {
			throw new Error('对齐等待缓冲区溢出');
		}

		if (this.buffers.length === 1) {
			this.controller.initialize(this.nodeGuid, data.timestamp);
		}
	}

	private async align(time: TimestampT) {
		// 找到第一个timestamp不大于time的帧，丢弃之前的帧
		const firstIndex = this.buffers.findLastIndex((frame) => frame.timestamp <= time);
		this.buffers.splice(0, firstIndex);

		// 当前buffers是有效数据
		const first = this.buffers[0];
		assert.ok(first, 'first frame must exist');

		// 恰好对齐
		if (first.timestamp === time) {
			return this.flush();
		}

		// 从first头部删掉一部分数据，使其timestamp对齐到time
		const delta = time - first.timestamp;
		const samples = Math.ceil(delta * first.rate);

		// 丢弃头部数据，不用复制数据，成功对齐
		first.content = first.content.subarray(samples);
		first.timestamp = time;

		this.logger.info`${this.sources[0].displayName} 丢弃 ${samples} 个起始样本，时间 ${delta} 微秒`;

		return this.flush();
	}

	private flush() {
		for (const frame of this.buffers) {
			this.emitData(frame);
		}
		this.buffers.length = 0;
		Object.freeze(this.buffers);
		this.rewire();
	}
}

application.adapters.registerNode(FrameAlign);
