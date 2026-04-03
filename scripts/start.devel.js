import { execa } from 'execa';
import * as readline from 'node:readline';

async function startProcess() {
	const child = execa('node', ['scripts/start.js'], {
		stdin: 'ignore',
		stdout: 'inherit',
		stderr: 'inherit',
	});

	return child;
}

let current = await startProcess();

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', async (line) => {
	if (line.endsWith('rs')) {
		console.log('[devel] 重启中...');
		current.kill();
		await current.catch(() => {});
		current = await startProcess();
	}
});
