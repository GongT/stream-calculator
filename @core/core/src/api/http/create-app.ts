import { convertCaughtError, oneDay, prettyFormatError } from '@idlebox/common';
import express from 'express';
import { extname } from 'node:path';
import { ApiErrorCode } from '../common/error.js';
import type { IErrorResponse } from '../common/protocol.js';

type Initialize = (app: express.Application, api: express.Application) => void;

/** @internal */
export function createExpress(initialize: Initialize) {
	const app: express.Application = express();

	app.set('trust proxy', true);
	app.set('case sensitive routing', true);
	app.set('strict routing', true);
	app.set('x-powered-by', false);
	app.set('query parser', 'extended');

	const api: express.Application = express();
	api.set('etag', false);
	api.set('query parser', false);

	api.use(express.json({ type: '*/*' }));

	app.use('/api', api);

	initialize(app, api);

	api.use(jsonNotFoundHandler);
	api.use(jsonErrorHandler);

	app.use(htmlNotFoundHandler);
	app.use(htmlErrorHandler);
}

const unknownFileCache = 'public, max-age=604800, immutable'; // 7d
const cacheControl: Record<string, string> = {
	'.html': 'public, max-age=5',
};

/** @internal */
export function createStatic(dir: string, rewrite: boolean): express.Handler[] {
	const serve = express.static(dir, {
		fallthrough: true,
		cacheControl: false,
		immutable: rewrite,
		maxAge: 7 * oneDay,
		index: !rewrite,
		setHeaders(res, path, _stat) {
			const ext = extname(path);
			res.setHeader('Cache-Control', cacheControl[ext] ?? unknownFileCache);
		},
	});

	const r = [serve];

	if (rewrite) {
		r.push((req, res, next) => {
			req.url = '/index.html';
			serve(req, res, next);
		});
	}

	return r;
}

function jsonNotFoundHandler(_req: express.Request, res: express.Response) {
	res.status(404).json({ code: ApiErrorCode.NotExists, message: 'Not Found' } satisfies IErrorResponse);
}

function jsonErrorHandler(err: any, _req: express.Request, res: express.Response) {
	const { message, stack, ...details } = convertCaughtError(err);
	res.status(500).json({ code: ApiErrorCode.Unknown, message: 'Internal Server Error', details, _stack: stack } satisfies IErrorResponse);
}

function htmlNotFoundHandler(_req: express.Request, res: express.Response) {
	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	res.status(404).send('<h1>Not Found</h1>');
}

function htmlErrorHandler(err: any, _req: express.Request, res: express.Response) {
	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	res.status(500).send(`<h1>Internal Server Error</h1><pre>${prettyFormatError(err)}</pre>`);
}
