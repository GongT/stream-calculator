import { createArgsReader } from '@idlebox/args';
import { UsageError } from '@idlebox/common';

const args = createArgsReader(process.argv.slice(2));
const verbose = args.flag(['--verbose', '-v']);
const debug = args.flag(['--debug', '-d']);

export const isVerbose = verbose > 0 || debug > 1;
export const isDebug = debug > 0 || verbose > 0;

export const app_name = args.single(['--program', '-p']);
export const backendPackageName = args.single(['--backend', '-b']);
export const frontendPackageName = args.single(['--frontend', '-F']);

export const http_listen = args.single(['--http-listen']) || '38083';

if (args.unused().length) {
	usage();
	throw new UsageError(`意外参数: ${args.unused()[0]}`);
}

if (!app_name) {
	usage();
	throw new UsageError(`缺少主程序名称参数`);
}

function usage() {
	console.log(`用法:
	--program           主程序包名称，必须
	--backend           后端包名称
	--frontend          前端包名称
	--http-listen       HTTP监听地址（端口号）
	--debug, -d         调试输出
	--verbose, -v       详细输出
`); 
	console.log(`示例: $0 --program @program/sample-app --backend @program/sample-management --frontend @program/sample-frontend`);
}

export const applicationPackageName = app_name;
