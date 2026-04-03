import type { IMyLogger } from '@idlebox/logger';
import type { ExpressErrorRequestHandler, ExpressMiddleware, ExpressRequest, ExpressResponse } from './express-types.js';

export interface RawRequestContext {
	readonly logger: IMyLogger;
}

export type HttpRawApiHandler = (this: RawRequestContext, request: ExpressRequest, response: ExpressResponse) => Promise<void>;
export interface IHttpRawApiEndpointOptions {
	readonly displayName?: string;
	readonly path: string;
	readonly method: 'get' | 'post' | 'options';
	readonly handle: HttpRawApiHandler;
}

/**
 * @internal
 */
export class HttpRawApiEndpoint {
	constructor(
		private readonly options: IHttpRawApiEndpointOptions,
		protected readonly logger: IMyLogger,
	) {}

	get displayName() {
		return this.options.displayName ?? `RawApi<${this.options.method.toUpperCase()} ${this.options.path}>`;
	}

	get method() {
		return this.options.method;
	}

	get path() {
		return this.options.path;
	}

	get METHOD() {
		return this.options.method.toUpperCase();
	}

	getErrorHandler(): ExpressErrorRequestHandler {
		throw new Error('Method not implemented.');
	}
	getHandle(): ExpressMiddleware {
		throw new Error('Method not implemented.');
	}
}
