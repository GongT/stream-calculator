import type { IErrorResponse } from './protocol.js';

export class ApiError extends Error {
	constructor(
		public readonly code: ApiErrorCode,
		message?: string,
		public readonly details?: any,
	) {
		super(message);
	}

	toJSON(): IErrorResponse {
		return {
			code: this.code,
			message: this.message,
			details: this.details,
			_stack: this.stack,
		};
	}
}

export enum ApiErrorCode {
	None = 0,

	Unknown = 1,

	InvalidInput = 1000,
	InvalidOutput = 1001,
}
