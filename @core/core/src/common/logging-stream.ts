import type { IMyLogger } from '@idlebox/logger';
import type { Writable } from 'node:stream';
import split2 from 'split2';

export function makeLoggerStream(logger: IMyLogger, prefix: string): Writable {
	logger = logger.extend(prefix);
	const split = split2();

	split.on('data', (line: string) => {
		logger.log`printable<${line}>`;
	});

	return split;
}
