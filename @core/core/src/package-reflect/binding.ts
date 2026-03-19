// const require = createRequire(import.meta.url);

import { NotError, type IPackageJson } from '@idlebox/common';
import { logger } from '@idlebox/logger';
import { findPackageJSON } from 'node:module';

type AnyConstructor = new (...args: any[]) => any;

/** @internal */
export interface IBinding {
	readonly filepath: string;
	readonly classes: AnyConstructor[];
}

class PackageBinding {
	private readonly bindings = new Map<string, IBinding>();
	private readonly reverse = new Map<AnyConstructor, string>();

	public addClass(Class: AnyConstructor, filepath: string) {
		const pkgJsonPath = this.getPackageJsonPath(filepath);
		if (!pkgJsonPath) {
			throw new Error(`Cannot find package.json for path: ${filepath}`);
		}
		const exists = this.bindings.get(pkgJsonPath);
		if (exists) {
			exists.classes.push(Class);
		} else {
			this.bindings.set(pkgJsonPath, {
				filepath: filepath,
				classes: [Class],
			});
		}
		this.reverse.set(Class, pkgJsonPath);
	}

	public getPackageJsonPath(filepath: string) {
		if (!filepath.endsWith('package.json')) {
			const pkgPath = findPackageJSON('..', filepath);
			if (!pkgPath) {
				logger.fatal`根据路径 relative<${filepath}> 找不到对应的 package.json`;
				throw new NotError('fatal');
			}
			filepath = pkgPath;
		}
		return filepath;
	}

	public getClasses(filepath: string, optional = false) {
		filepath = this.getPackageJsonPath(filepath);
		const binding = this.bindings.get(filepath);
		if (!binding) {
			if (optional) return [];

			logger.fatal`程序包 relative<${filepath}> 尚未注册任何类型`;
			throw new NotError('fatal');
		}
		return binding.classes;
	}

	public async getPackageJson(Class: AnyConstructor): Promise<IPackageJson> {
		const pkgJsonPath = this.reverse.get(Class);
		if (!pkgJsonPath) {
			logger.fatal`未找到类型${Class.name}所属的程序包`;
			throw new NotError('fatal');
		}
		const r = await import(pkgJsonPath, { with: { type: 'json' } });
		// logger.verbose`加载package.json (${r.default.name})`;
		return r.default;
	}
}

/** @internal */
export const reflectBinding = new PackageBinding();
