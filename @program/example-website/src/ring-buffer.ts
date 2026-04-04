export class ChannelBuffer {
	private readonly buffer;
	private cursor = 0;

	constructor(private readonly view: number) {
		this.buffer = new Int32Array(view * 10);
	}

	push(data: Int32Array): void {
		if (this.cursor + data.length > this.buffer.length) {
			const start = this.cursor + data.length - this.view;
			this.buffer.copyWithin(0, start);
			this.cursor = this.buffer.length - start;
		}

		this.buffer.set(data, this.cursor);
		this.cursor += data.length;
	}

	getCurrentBuffer(): Int32Array {
		const v = this.cursor - this.view;
		if (v < 0) {
			return this.buffer.subarray(0, this.view);
		}
		return this.buffer.subarray(v, v + this.view);
	}

	debug() {
		const v = this.getCurrentBuffer();
		return `cursor: ${this.cursor}/${this.buffer.length}, currentView: ${v.length} [${v.slice(0, 5).join(', ')} ... ${v.slice(-5).join(', ')}]`;
		// return `cursor: ${this.cursor}/${this.buffer.length}`;
	}
}
