import { REPO_ROOT } from '@core/core';
import { prettyPrintError, SoftwareDefectError } from '@idlebox/common';
import { registerNodejsExitHandler, registerNodejsGlobalTypedErrorHandler, shutdown, workingDirectory } from '@idlebox/node';
import { logger } from '../tools/misc.js';

workingDirectory.chdir(REPO_ROOT);
process.stderr.setMaxListeners(20);

registerNodejsExitHandler(logger);
registerNodejsGlobalTypedErrorHandler(SoftwareDefectError, (e) => {
	prettyPrintError(e.message, e?.cause ?? e);
	shutdown(1);
});
