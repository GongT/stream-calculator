import { execa } from 'execa';
import * as readline from 'node:readline';

function startProcess() {
	const child = execa('node', ['scripts/start.js'], {
		stdin: 'pipe',
		stdout: 'inherit',
		stderr: 'inherit',
		reject: false,
	});

	child.then(({ exitCode }) => {
		process.exitCode = exitCode;
		console.log('\x1B[38;5;9m[devel] 程序退出 (code=%s)\x1B[0m', exitCode);
	});

	return child;
}

let current = startProcess();

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', async (line) => {
	if (line.endsWith('rs')) {
		console.log('[devel] 重启中...');
		current.kill();
		await current.catch(() => {});
		current = startProcess();
	} else {
		current.stdin.write(`${line}\n`);
	}
});
