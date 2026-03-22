import { z } from '@core/core';

application.api.provideJsonApi({
	path: 'hello',
	input: z.object({ x: z.string() }),
	output: z.object({ a: z.number() }),
	handle: function (this, input): Promise<unknown> {
		return Promise.resolve({ a: input.x.length });
	},
});
