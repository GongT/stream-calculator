export interface IActivateProtocol {
	startup(): Promise<void> | void;
}
