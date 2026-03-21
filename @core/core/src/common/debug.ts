import { definePrivateConstant } from '@idlebox/common';

const symbol = Symbol('declaration-file');

function isClass(fn: any) {
	return typeof fn === 'function' && fn.prototype?.constructor === fn;
}

export function rememberDeclareation(clsOrFn: any, file: string, attachPrototype: boolean = isClass(clsOrFn)) {
	const exists = getDeclarationFile(clsOrFn);
	if (exists && exists !== file) {
		throw new Error(`${clsOrFn.name} is declared in ${exists} and ${file}`);
	}
	if (attachPrototype) {
		definePrivateConstant(clsOrFn.prototype, symbol, file);
	}
	definePrivateConstant(clsOrFn, symbol, file);
}

export function getDeclarationFile(clsOrFn: any): string | undefined {
	return clsOrFn[symbol];
}
