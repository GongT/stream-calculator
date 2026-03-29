import 'node:http';
import type { WebSocketEndpoint } from './api/socket/type.js';

declare module 'node:http' {
	interface IncomingMessage {
		pathname?: string;
		endpoint?: WebSocketEndpoint;
	}
}
