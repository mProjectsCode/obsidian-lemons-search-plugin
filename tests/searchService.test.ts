import { describe, expect, mock, test } from 'bun:test';

const workerInstances: FakeWorker[] = [];

class FakeWorker {
	onmessage: ((event: MessageEvent) => void) | null = null;
	readonly messages: unknown[] = [];

	constructor() {
		workerInstances.push(this);
	}

	postMessage(message: unknown): void {
		this.messages.push(message);
	}

	terminate(): void {}

	initialize(): void {
		this.onmessage?.(new MessageEvent('message', { data: { method: 'onInitialized', args: [] } }));
	}
}

mock.module('packages/obsidian/src/searchWorker/search.worker?worker&inline', () => ({
	default: FakeWorker,
}));

const { SearchService } = await import('../packages/obsidian/src/searchWorker/SearchService');

describe('SearchService initialization', () => {
	test('sends persisted engine configuration before resolving readiness', () => {
		const plugin = {
			settings: {
				maxResults: 37,
				fullTextFuzzySearch: false,
			},
		};
		const service = new SearchService(plugin as never);

		service.initialize();
		const worker = workerInstances.at(-1);
		expect(worker).toBeDefined();

		worker!.initialize();

		expect(worker!.messages).toEqual([
			{ method: 'setMaxResults', args: [37] },
			{ method: 'setFullTextFuzzySearch', args: [false] },
		]);
	});
});
