import '@core/core';
import { createRootLogger, EnableLogLevel, set_default_log_level } from '@idlebox/logger';
import { isDebug, isVerbose } from '../fragment/00-args.js';

const logLevel = isVerbose ? EnableLogLevel.verbose : isDebug ? EnableLogLevel.debug : EnableLogLevel.log;
set_default_log_level(logLevel);

createRootLogger('', logLevel);

export const logger = application.logger.extend('bootstrap');
