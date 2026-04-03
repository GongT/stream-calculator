import { config } from 'dotenv';
import { resolve } from 'node:path';

config({
	override: true,
	path: [resolve(import.meta.dirname, '../.env.sample'), resolve(import.meta.dirname, '../.env')],
});

const inputArgs = process.argv.slice(2);

const entry = import.meta.resolve('@core/bootstrap');
process.argv.splice(
	1,
	process.argv.length,
	entry,
	'--program=@program/sample-app',
	'--backend=@program/sample-management',
	'--frontend=@program/example-website',
	...inputArgs,
);

await import(entry);
