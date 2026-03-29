import type { ApiErrorCode } from './error.js';

export type IStandardResponse<T> = IErrorResponse | ISuccessResponse<T> | IPagedResponse<T>;

export interface IErrorResponse {
	code: ApiErrorCode;
	message: string;
	details?: any;
	_stack?: string;
}

export interface ISuccessResponse<T = any> {
	code: 0;
	data: T;
}

export interface IPagedResponse<T = any> {
	code: 0;
	list: T[];
	pager: IStandardResponsePager;
}

export interface IStandardResponsePager {
	page: number;
	pageSize: number;
	total: number;
}

export interface IStandardRequestPager {
	page: number;
	pageSize: number;
}
