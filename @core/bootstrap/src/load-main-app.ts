import { AppHost, convertToSourcePath, type IActivateProtocol } from '@core/core';
import { createArgsReader } from '@idlebox/args';
import { convertCaughtError, ErrorWithCode, ExitCode, registerGlobalLifecycle, SoftwareDefectError } from '@idlebox/common';
import { createRootLogger, EnableLogLevel, logger } from '@idlebox/logger';
import { registerNodejsExitHandler, workingDirectory } from '@idlebox/node';
import { REPO_ROOT } from '@shared/common';

workingDirectory.chdir(REPO_ROOT);
registerNodejsExitHandler();

const args = createArgsReader(process.argv.slice(2));
const v = args.flag(['--verbose', '-v']);
const d = args.flag(['--debug', '-d']);

createRootLogger('', v || d > 1 ? EnableLogLevel.verbose : d ? EnableLogLevel.debug : EnableLogLevel.log);

const app_name = args.range(0, 1)[0];

if (!app_name) {
	throw new ErrorWithCode(`缺少主程序名称参数`, ExitCode.USAGE);
}

if (args.unused().length) {
	throw new ErrorWithCode(`意外参数: ${args.unused()[0]}`, ExitCode.USAGE);
}

logger.info`加载主程序 ${app_name}`;
let mainAppPath: string;
try {
	mainAppPath = await import.meta.resolve(app_name);
} catch (e) {
	throw new ErrorWithCode(`未找到主程序包`, ExitCode.USAGE, { cause: convertCaughtError(e) });
}

let mainAppExports: IActivateProtocol;
try {
	mainAppExports = await import(app_name);
	if (!mainAppExports || typeof mainAppExports.startup !== 'function') {
		console.log(mainAppExports);
		throw new SoftwareDefectError(`主程序不符合 IActivateProtocol 接口要求: ${convertToSourcePath(mainAppPath, true)}`);
	}
} catch (e) {
	throw new SoftwareDefectError(`加载主程序包失败`, { cause: convertCaughtError(e) });
}

const host = new AppHost();
registerGlobalLifecycle(host);

await host.activate();
await mainAppExports.startup(host);
