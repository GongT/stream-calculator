import { prettyPrintError, SoftwareDefectError } from '@idlebox/common';
import { registerNodejsExitHandler, registerNodejsGlobalTypedErrorHandler, shutdown, workingDirectory } from '@idlebox/node';
import { REPO_ROOT } from '@shared/common';
import { logger } from '../tools/misc.js';

workingDirectory.chdir(REPO_ROOT);

registerNodejsExitHandler({
	output(message) {
		logger.log`long<${message}>`;
	},
	verbose(message) {
		logger.debug`long<${message}>`;
	},
});
registerNodejsGlobalTypedErrorHandler(SoftwareDefectError, (e) => {
	prettyPrintError(e.message, e.cause!);
	shutdown(1);
});
