import { glob } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function startup() {
	const ps: any[] = [];
	const definePath = resolve(import.meta.dirname, 'endpoints');
	for await (const file of glob('**/*.js', { cwd: definePath })) {
		const abs = resolve(definePath, file);
		ps.push(import(abs));
	}

	await Promise.all(ps);
}
