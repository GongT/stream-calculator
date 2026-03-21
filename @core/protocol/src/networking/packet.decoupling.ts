import { SoftwareDefectError } from '@idlebox/common';
import type { INetworkPayloadConstructor } from '../common/type.network.js';

export enum Action {
	KEEP_ALIVE = 1,
	KEEP_ALIVE_RESPONSE = 2,
	DATA = 3,
}

const registryActionToClass = new Map<Action, INetworkPayloadConstructor>();
const registryClassToAction = new Map<INetworkPayloadConstructor, Action>();

function PayloadClassDecorator(Class: INetworkPayloadConstructor) {
	if (Class.length) {
		throw new SoftwareDefectError(`网络包类型“${Class.name}”存在必选参数`);
	}
	const action: Action = new Class().kind;
	registryActionToClass.set(action, Class);
	registryClassToAction.set(Class, action);
}

/**
 * @internal
 */
export const Payload = PayloadClassDecorator;

export function getActionPayloadType(action: Action): INetworkPayloadConstructor {
	const Class = registryActionToClass.get(action);
	if (!Class) {
		throw new SoftwareDefectError(`没有注册的网络包类型: ${action}`);
	}
	return Class;
}

export function getPayloadAction(Type: INetworkPayloadConstructor): Action {
	const action = registryClassToAction.get(Type);
	if (action === undefined) {
		throw new SoftwareDefectError(`类型没有使用@Payload注册: ${Type.name}`);
	}
	return action;
}
