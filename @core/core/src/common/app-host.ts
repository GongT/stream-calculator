import { EnhancedAsyncDisposable } from '@idlebox/common';
import { adapterHost } from '../adapter-helpers/adapter-host.js';
import { HttpApiHost } from '../http-api/http-api-host.js';
import type { IAppHost } from './activate.js';

export class AppHost extends EnhancedAsyncDisposable implements IAppHost {
	readonly api = new HttpApiHost();
	readonly adapter = adapterHost;

	constructor() {
		super('AppHost');
	}

	async activate() {
		await this.adapter.activate();
	}
}
