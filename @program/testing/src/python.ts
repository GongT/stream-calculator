import { UsageError } from '@idlebox/common';
import { logger } from '@idlebox/logger';
import { execa } from 'execa';
import { resolve } from 'node:path';

let pythonFound: Promise<string> | null = null;

export function getPython() {
	if (!pythonFound) pythonFound = getPy();
	return pythonFound;
}

const noPoetry = 'No module named poetry';

async function getPy(retry = false) {
	const pythonProjectRoot = resolve(import.meta.dirname, '../python-testing-environment');
	const exec = execa({
		stdout: 'pipe',
		stderr: 'pipe',
		reject: false,
		all: true,
		cwd: pythonProjectRoot,
	});
	const proc = await exec`python -m poetry env info -e`;

	if (proc.code === 'ENOENT') {
		// 找不到python
		throw new UsageError(`找不到Python可执行文件: ${proc.message}`);
	}

	if (proc.exitCode || proc.signal) {
		const output = proc.all.trim();
		if (output.includes(noPoetry)) {
			throw new UsageError(`找不到Poetry模块。`);
		}
		if (output === '' && !retry) {
			await exec({
				stdout: 'inherit',
				stderr: 'inherit',
				reject: true,
			})`python -m poetry install`;
			return getPy(true);
		}
		throw new UsageError(`python环境异常:\n${output}`);
	}

	logger.success`找到Python: ${proc.stdout.trim()}`;
	return proc.stdout.trim();
}
