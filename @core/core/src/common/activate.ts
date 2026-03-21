import type { EventRegister, IAsyncDisposable } from '@idlebox/common';
import type { AdapterHost } from '../adapter-helpers/adapter-host.js';
import type { HttpApiHost } from '../http-api/http-api-host.js';

export interface IAppHost {
	readonly onBeforeDispose: EventRegister<void>;
	_register(d: IAsyncDisposable): void;
	readonly api: HttpApiHost;
	readonly adapters: AdapterHost;
}

export interface IActivateProtocol {
	startup(register: IAppHost): Promise<void> | void;
}
