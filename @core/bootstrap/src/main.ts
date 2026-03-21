import { install } from '@idlebox/source-map-support';

install();

if (process.stderr.isTTY) {
	process.stderr.write('\x1Bc');
}

const { registerNodejsExitHandler } = await import('@idlebox/node');
registerNodejsExitHandler();

await import('./load-main-app.js');
