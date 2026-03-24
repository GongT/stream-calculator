import { prettyFormatError } from '@idlebox/common';
import express from 'express';

type Initialize = (app: express.Application, api: express.Application) => void;

/**
 * @internal
 */
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

export function createStatic(dir: string): express.Handler {
	return express.static(dir);
}

function jsonNotFoundHandler(_req: express.Request, res: express.Response) {
	res.status(404).json({ error: 'Not Found' });
}

function jsonErrorHandler(err: any, _req: express.Request, res: express.Response) {
	console.error(err);
	res.status(500).json({ error: 'Internal Server Error' });
}

function htmlNotFoundHandler(_req: express.Request, res: express.Response) {
	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	res.status(404).send('<h1>Not Found</h1>');
}

function htmlErrorHandler(err: any, _req: express.Request, res: express.Response) {
	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	res.status(500).send(`<h1>Internal Server Error</h1><pre>${prettyFormatError(err)}</pre>`);
}
