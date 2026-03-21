export function parseAddress(address: string): [string, number, 4 | 6] {
	let family: 4 | 6 = 4;

	const url = new URL(`net://${address}`);
	const port = Number.parseInt(url.port, 10);
	if (Number.isNaN(port)) {
		throw new Error(`无效地址，端口号无效: ${address}`);
	}

	if (!(port > 0 && port < 65535)) {
		throw new Error(`无效地址，端口号超出范围: ${address}`);
	}

	let ipAddr = url.hostname;
	if (ipAddr.startsWith('[')) {
		ipAddr = ipAddr.slice(1, -1);
		family = 6;
	}

	return [ipAddr, port, family];
}
