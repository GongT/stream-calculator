import { CanceledError, convertCaughtError, Emitter, type CancellationToken } from '@idlebox/common';
import { createLogger } from '@idlebox/logger';
import split2 from 'split2';

abstract class AbstractTextReader {
	protected readonly _onLine = new Emitter<string>();

	private readonly _onEnd = new Emitter<void>();
	public readonly onEnd = this._onEnd.event;

	protected readonly stream: NodeJS.ReadWriteStream;

	protected readonly logger = createLogger('text');

	constructor(protected readonly sourceStream: NodeJS.ReadableStream) {
		const splitStream = sourceStream.pipe(split2());
		splitStream.on('data', (line: string) => {
			this.logger.verbose`printable<${line}>`;
			this._onLine.fireNoError(line);
		});
		splitStream.on('end', () => {
			if (!this._onEnd.hasDisposed) this._onEnd.fireNoError();
		});
		this.stream = splitStream;
	}

	join() {
		return new Promise<void>((resolve) => {
			this.stream.once('end', () => {
				resolve();
			});
		});
	}

	dispose() {
		this._onEnd.dispose();
		this._onLine.dispose();
		this.sourceStream.unpipe(this.stream);
		this.stream.end();
	}
}

type StringMatchFunction = (line: string) => boolean;
export class LineReader extends AbstractTextReader {
	public readonly onLine = this._onLine.event;

	protected override readonly logger = createLogger('text:line');

	waitFor(matcher: RegExp | StringMatchFunction | string, cancellationToken?: CancellationToken) {
		if (typeof matcher === 'string') {
			matcher = (line) => line === matcher;
		} else if (matcher instanceof RegExp) {
			matcher = matcher.test.bind(matcher);
		}
		return new Promise<string>((resolve, reject) => {
			const dis = this.onLine((line) => {
				if (matcher(line)) {
					dis.dispose();
					resolve(line);
				}
			});
			if (cancellationToken) {
				cancellationToken.onCancellationRequested(() => {
					dis.dispose();
					reject(new CanceledError());
				});
			}
		});
	}
}

type ObjectMatchFunction<T> = (obj: T) => boolean;
export class JsonReader<T> extends AbstractTextReader {
	private readonly _onData = new Emitter<T>();
	public readonly onData = this._onData.event;

	private readonly _onError = new Emitter<Error & { text: string }>();
	public readonly onError = this._onError.event;

	protected override readonly logger = createLogger('text:json');

	constructor(sourceStream: NodeJS.ReadableStream) {
		super(sourceStream);

		this._onLine.handle((line) => {
			try {
				const data = JSON.parse(line);
				this._onData.fireNoError(data);
			} catch (err) {
				const error = convertCaughtError(err);
				this._onError.fireNoError(Object.assign(error, { text: line }));
			}
		});
	}

	waitFor(matcher: ObjectMatchFunction<T>, cancellationToken?: CancellationToken) {
		return new Promise<T>((resolve, reject) => {
			const dis = this.onData((data) => {
				if (matcher(data)) {
					dis.dispose();
					resolve(data);
				}
			});
			if (cancellationToken) {
				cancellationToken.onCancellationRequested(() => {
					dis.dispose();
					reject(new CanceledError());
				});
			}
		});
	}

	override dispose() {
		this._onData.dispose();
		this._onError.dispose();
		super.dispose();
	}
}
