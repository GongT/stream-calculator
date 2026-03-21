import { logger } from '@idlebox/logger';
import { execa } from 'execa';
import { resolve } from 'node:path';

let pythonFound: Promise<string> | null = null;

export function getPython() {
	if (!pythonFound) pythonFound = getPy();
	return pythonFound;
}

async function getPy() {
	const pythonProjectRoot = resolve(import.meta.dirname, '../python-testing-environment');
	const proc = await execa({
		stdout: 'pipe',
		stderr: 'inherit',
		cwd: pythonProjectRoot,
	})`poetry env info -e`;

	logger.success`找到Python: ${proc.stdout.trim()}`;
	return proc.stdout.trim();
}
