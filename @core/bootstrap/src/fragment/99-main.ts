import { ExitCode, interval, registerGlobalLifecycle } from '@idlebox/common';
import { loadPackageByName } from '../tools/loader.js';
import { logger } from '../tools/misc.js';
import { applicationPackageName, backendPackageName, isDebug, isVerbose } from './00-args.js';

const mainApp = await loadPackageByName(applicationPackageName, '主程序');
const backendApp = backendPackageName ? await loadPackageByName(backendPackageName, '后端') : null;

process.exitCode = ExitCode.EXECUTION;

await application.adapters.activate();
logger.debug`用户程序已激活`;

await mainApp.startup(application);
if (backendApp) {
	await backendApp.startup(application);
} else {
	logger.info`未指定后端程序`;
}

if (process.stderr.isTTY && !isDebug && !isVerbose) {
	registerGlobalLifecycle(
		interval(
			1000,
			() => {
				application.printStatus();
			},
			true,
		),
	);
}

logger.debug`流程定义已加载`;

const nodes = [];
for (const node of application.adapters.nodes) {
	nodes.push(node);
}
await Promise.all(nodes.map((node) => node.__initialize()));

logger.info`开始数据流处理，总共${nodes.length}个节点`;
for (const node of nodes) {
	node.resume();
}

logger.debug`数据流处理中`;

/** 调用隐藏方法 */
await (application.api as any).start();
