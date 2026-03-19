import { EnhancedAsyncDisposable, type DeepReadonly, type IPackageJson } from '@idlebox/common';

export interface IBaseAdapterOptions {
	readonly packageJson: DeepReadonly<IPackageJson>;
}
export abstract class Adapter extends EnhancedAsyncDisposable {
	constructor(public readonly options: IBaseAdapterOptions) {
		super(`Adapter<${options.packageJson.name}>`);
	}

	public abstract activate(): void | Promise<void>;
}
