import type { MaybePromise } from 'packages/obsidian/src/utils/utils';

export class Deferred<T = void> {
	readonly promise: Promise<T>;
	private settled = false;
	private resolvePromise!: (value: T | PromiseLike<T>) => void;
	private rejectPromise!: (reason?: unknown) => void;

	constructor() {
		this.promise = new Promise<T>((resolve, reject) => {
			this.resolvePromise = resolve;
			this.rejectPromise = reject;
		});
	}

	resolve(value: T | PromiseLike<T>): void {
		if (this.settled) {
			return;
		}
		this.settled = true;
		this.resolvePromise(value);
	}

	reject(reason?: unknown): void {
		if (this.settled) {
			return;
		}
		this.settled = true;
		this.rejectPromise(reason);
	}
}

export class AsyncSerialQueue {
	private tail: Promise<void> = Promise.resolve();
	private onError: (error: unknown) => void;

	constructor(onError: (error: unknown) => void) {
		this.onError = onError;
	}

	enqueue<T>(cb: () => MaybePromise<T>): Promise<T> {
		const run = this.tail.then(
			() => cb(),
			() => cb(),
		);
		this.tail = run.then(
			() => undefined,
			error => {
				this.onError(error);
			},
		);
		return run;
	}

	async whenIdle(): Promise<void> {
		await this.tail;
	}
}

export async function sleep(ms: number): Promise<void> {
	await new Promise<void>(resolve => window.setTimeout(resolve, ms));
}

export async function waitForIdle(fallbackMs: number = 0): Promise<void> {
	await new Promise<void>(resolve => {
		window.setTimeout(resolve, fallbackMs);
	});
}
