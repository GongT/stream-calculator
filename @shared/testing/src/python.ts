import { logger } from '@idlebox/logger';
import { execa } from 'execa';

let pythonFound: Promise<string> | null = null;

export function getPython() {
	if (!pythonFound) pythonFound = getPy();
	return pythonFound;
}

async function getPy() {
	const proc = await execa({ stdout: 'pipe', stderr: 'inherit' })`poetry env info -e`;

	logger.success`找到Python: ${proc.stdout.trim()}`;
	return proc.stdout.trim();
}
