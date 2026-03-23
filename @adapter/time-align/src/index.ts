import { Adapter } from '@core/core';
export { FrameResizer as TimeAligner } from './slice.js';

class TimeAlignerAdapter extends Adapter {
	public override activate(): void | Promise<void> {}
}

application.adapters.registerAdapter(TimeAlignerAdapter);
