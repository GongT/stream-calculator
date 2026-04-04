import { Adapter } from '@core/core';
export { createFrameAlign } from './align.js';
export { ReTimer } from './retime.js';
export { FrameResizer, FrameResizer as TimeAligner } from './slice.js';

class TimeAlignerAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}

application.adapters.registerAdapter(TimeAlignerAdapter);
