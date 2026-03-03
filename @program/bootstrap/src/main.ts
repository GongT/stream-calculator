import { createArgsReader } from '@idlebox/args';
import { ErrorWithCode, ExitCode } from '@idlebox/common';
import { createRootLogger, EnableLogLevel, logger } from '@idlebox/logger';
import { registerNodejsExitHandler, workingDirectory } from '@idlebox/node';
import { REPO_ROOT } from '@shared/common';

workingDirectory.chdir(REPO_ROOT);
registerNodejsExitHandler();

const args = createArgsReader(process.argv.slice(2));
args.flag(['--verbose', '-v']);
args.flag(['--debug', '-d']);

createRootLogger('', EnableLogLevel.auto);

const app_name = args.range(0, 1)[0];

if (!app_name) {
	throw new ErrorWithCode(`缺少主程序名称参数`, ExitCode.USAGE);
}

if (args.unused().length) {
	throw new ErrorWithCode(`意外参数: ${args.unused()[0]}`, ExitCode.USAGE);
}

logger.info('加载主程序: %s', app_name);
