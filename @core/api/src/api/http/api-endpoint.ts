import type { IMyLogger } from '@idlebox/logger';
import { z, type ZodType } from 'zod';
import { ApiError, ApiErrorCode } from '../../common/error.js';
import type { ExpressErrorRequestHandler, ExpressMiddleware } from './express-types.js';

export interface ApiRequestContext {
	readonly logger: IMyLogger;
}

export type HttpApiHandler<RequestType, ResponseType> = (this: ApiRequestContext, input: RequestType) => Promise<ResponseType>;

export interface IHttpApiEndpointOptions<RequestType = any, ResponseType = any> {
	readonly displayName?: string;
	readonly path: string;
	readonly input: ZodType<RequestType>;
	readonly output: ZodType<ResponseType>;
	readonly handle: HttpApiHandler<RequestType, ResponseType>;
}

/**
 * @internal
 */
export class HttpApiEndpoint<RequestType = any, ResponseType = any> {
	constructor(
		private readonly options: IHttpApiEndpointOptions<RequestType, ResponseType>,
		protected readonly logger: IMyLogger,
	) {}

	get displayName() {
		return this.options.displayName ?? `JsonApi<${this.options.path}>`;
	}

	get path() {
		return `/${this.options.path}`;
	}

	getErrorHandler(): ExpressErrorRequestHandler {
		return (err, _req, res, _next) => {
			// this.logger.verbose`Error in API endpoint ${this.displayName}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`;
			if (err instanceof ApiError) {
				res.status(500).json(err.toJSON());
			} else {
				res.status(504).json({ error: 'Unknown error' });
			}
		};
	}
	getHandle(): ExpressMiddleware {
		const context: ApiRequestContext = {
			logger: this.logger,
		};
		return async (req, res, next) => {
			const { success, data, error } = this.options.input.safeParse(req.body);

			if (!success) {
				return next(
					new ApiError(ApiErrorCode.InvalidInput, 'Invalid input', {
						details: z.prettifyError(error),
					}),
				);
			}

			try {
				const response = await this.options.handle.call(context, data);

				res.json(response);
			} catch (error) {
				next(error);
			}
		};
	}
}
