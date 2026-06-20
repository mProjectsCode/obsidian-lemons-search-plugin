import { describe, expect, test } from 'bun:test';
import type { SearchService } from '../packages/obsidian/src/searchWorker/SearchService';
import { SearchDatastore } from '../packages/obsidian/src/searchWorker/SearchDatastore';

class FakeSearchService {
	clearCalls = 0;
	deletePrefixCalls: string[] = [];
	deletedRecords: string[] = [];
	upsertedRecords: unknown[] = [];
	beginError?: Error;
	finishError?: Error;

	async clearDatastore(): Promise<void> {
		this.clearCalls += 1;
	}

	async beginBulkLoad(): Promise<void> {
		if (this.beginError) {
			throw this.beginError;
		}
	}

	async finishBulkLoad(): Promise<void> {
		if (this.finishError) {
			throw this.finishError;
		}
	}

	async deleteRecordsByPrefix(_storeId: string, prefix: string): Promise<void> {
		this.deletePrefixCalls.push(prefix);
	}

	async deleteRecords(_storeId: string, ids: string[]): Promise<void> {
		this.deletedRecords.push(...ids);
	}

	async upsertRecords(_storeId: string, records: unknown[]): Promise<void> {
		this.upsertedRecords.push(...records);
	}

	async getDatastoreHealth(): Promise<unknown> {
		return {
			exists: true,
			kind: 'fullText',
			liveRecords: 0,
			tombstones: 0,
			recordIds: [],
			postingTerms: 0,
			postingOccurrences: 0,
		};
	}
}

function createStore(service: FakeSearchService): SearchDatastore<unknown> {
	return new SearchDatastore(service as unknown as SearchService, 'store:test', 'fullText');
}

async function isSettled(promise: Promise<void>): Promise<boolean> {
	let settled = false;
	promise.then(
		() => {
			settled = true;
		},
		() => {
			settled = true;
		},
	);
	await Promise.resolve();
	return settled;
}

async function withoutConsoleError(cb: () => Promise<void>): Promise<void> {
	const original = console.error;
	console.error = (): void => {};
	try {
		await cb();
	} finally {
		console.error = original;
	}
}

describe('SearchDatastore bulk loading', () => {
	test('holds whenSettled until bulk load finishes', async () => {
		const store = createStore(new FakeSearchService());

		await store.beginBulkLoad();
		const settled = store.whenSettled();

		expect(await isSettled(settled)).toBe(false);

		await store.finishBulkLoad();
		await settled;
		expect(await isSettled(settled)).toBe(true);
	});

	test('does not leave waiters stuck when begin fails', async () => {
		const service = new FakeSearchService();
		service.beginError = new Error('begin failed');
		const store = createStore(service);

		await withoutConsoleError(async () => {
			await expect(store.beginBulkLoad()).rejects.toThrow('begin failed');
		});

		await store.whenSettled();
	});

	test('clears and releases waiters when finish fails', async () => {
		const service = new FakeSearchService();
		service.finishError = new Error('finish failed');
		const store = createStore(service);

		await store.beginBulkLoad();
		await withoutConsoleError(async () => {
			await expect(store.finishBulkLoad()).rejects.toThrow('finish failed');
		});

		await store.whenSettled();
		expect(service.clearCalls).toBe(1);
	});

	test('clears JS metadata and owner mirrors when replaceAllOwners bulk load fails', async () => {
		const service = new FakeSearchService();
		const store = createStore(service);

		await store.replaceOwner('note.md', [{ id: 'owner:note.md:0:5', text: 'Alpha', meta: { content: 'Alpha', data: 'note.md' } }]);
		expect(store.getAllData()).toHaveLength(1);

		service.finishError = new Error('finish failed');

		await withoutConsoleError(async () => {
			await expect(
				store.replaceAllOwners(new Map([['other.md', [{ id: 'owner:other.md:0:4', text: 'Beta', meta: { content: 'Beta', data: 'other.md' } }]]])),
			).rejects.toThrow('finish failed');
		});

		expect(service.clearCalls).toBe(1);
		expect(store.getAllData()).toEqual([]);
		expect((await store.healthCheck()).jsOwners).toBe(0);
	});
});

describe('SearchDatastore owner tracking', () => {
	test('can replace an owner by deleting a record-id prefix instead of storing per-record owner ids', async () => {
		const service = new FakeSearchService();
		const store = new SearchDatastore(service as unknown as SearchService, 'store:test', 'fullText', {
			metadataStrategy: {
				type: 'none',
				hydrateResult: async () => undefined,
			},
			ownerDeletionStrategy: {
				type: 'record-id-prefix',
				getPrefix: ownerId => `owner:${ownerId}:`,
			},
		});

		await store.replaceOwner('note.md', [
			{ id: 'owner:note.md:0:5', text: 'Alpha' },
			{ id: 'owner:note.md:6:10', text: 'Beta' },
		]);

		expect(service.deletePrefixCalls).toEqual(['owner:note.md:']);
		expect(service.upsertedRecords).toEqual([
			{ id: 'owner:note.md:0:5', text: 'Alpha' },
			{ id: 'owner:note.md:6:10', text: 'Beta' },
		]);
	});

	test('skips prefix deletes while bulk loading because the wasm store was already cleared', async () => {
		const service = new FakeSearchService();
		const store = new SearchDatastore(service as unknown as SearchService, 'store:test', 'fullText', {
			metadataStrategy: {
				type: 'none',
				hydrateResult: async () => undefined,
			},
			ownerDeletionStrategy: {
				type: 'record-id-prefix',
				getPrefix: ownerId => `owner:${ownerId}:`,
			},
		});

		await store.beginBulkLoad();
		await store.replaceOwner('note.md', [{ id: 'owner:note.md:0:5', text: 'Alpha' }]);
		await store.finishBulkLoad();

		expect(service.deletePrefixCalls).toEqual([]);
		expect(service.upsertedRecords).toEqual([{ id: 'owner:note.md:0:5', text: 'Alpha' }]);
	});
});
