import type { IAppHost } from './app-host.js';

export interface IActivateProtocol {
	startup(register: IAppHost): Promise<void> | void;
}
