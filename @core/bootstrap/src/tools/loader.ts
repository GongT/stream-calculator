import { convertToSourcePath, type IActivateProtocol } from '@core/core';
import { convertCaughtError, SoftwareDefectError } from '@idlebox/common';
import { logger } from './misc.js';

export async function loadPackageByName(name: string, title: string) {
	logger.info`加载包: ${title} @ ${name}`;

	let resolvedPath: string;
	try {
		resolvedPath = import.meta.resolve(name);
	} catch (e) {
		throw new SoftwareDefectError(`${title}包无法定位 (name: ${name})`, { cause: convertCaughtError(e) });
	}

	let exports: IActivateProtocol;
	try {
		exports = await import(resolvedPath);
		if (!exports || typeof exports.startup !== 'function') {
			console.log(exports);
			throw new SoftwareDefectError(`${title}不符合 IActivateProtocol 接口要求: ${convertToSourcePath(resolvedPath, true)}`);
		}
		return exports;
	} catch (e) {
		throw new SoftwareDefectError(`${title}包加载失败 (${resolvedPath})`, { cause: convertCaughtError(e) });
	}
}
