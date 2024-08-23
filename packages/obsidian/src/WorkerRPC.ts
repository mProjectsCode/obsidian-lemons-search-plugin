export type WorkerRPCConfig = Record<string, unknown[]>;

export type WorkerRPCMethods<TConfig extends WorkerRPCConfig> = {
	[K in keyof TConfig]: (...args: TConfig[K]) => void;
};

export class WorkerRPC<TMethods extends WorkerRPCConfig, THandlers extends WorkerRPCConfig> {
	private methods: WorkerRPCMethods<THandlers>;
	private post: (message: unknown) => void;

	constructor(methods: WorkerRPCMethods<THandlers>, post: (message: unknown) => void) {
		this.methods = methods;
		this.post = post;
	}

	call<K extends keyof TMethods>(method: K, ...args: TMethods[K]): void {
		// console.log('calling', method, args);

		this.post({ method, args });
	}

	onMessage(message: unknown): void {
		// console.log('received', message);

		if (typeof message !== 'object' || message === null) {
			return;
		}

		const { method, args } = message as { method: keyof THandlers; args: unknown[] };
		if (typeof method !== 'string') {
			return;
		}

		const handler = this.methods[method];
		if (handler) {
			// @ts-expect-error
			handler(...args);
		}
	}
}
