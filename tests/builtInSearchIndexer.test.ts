import { describe, expect, test } from 'bun:test';
import type { CachedMetadata, EventRef, TAbstractFile, TFile } from 'obsidian';
import { TFile as ObsidianTFile } from 'obsidian';
import { BuiltInSearchIndexer } from '../packages/obsidian/src/searchWorker/BuiltInSearchIndexer';
import { FullTextRecordIds } from '../packages/obsidian/src/searchWorker/FullTextBlocks';
import type { SearchDatum } from '../packages/obsidian/src/searchUI/SearchController';
import type { FullTextBlockMeta } from '../packages/obsidian/src/searchWorker/FullTextBlocks';
import type { SearchRecord } from '../packages/obsidian/src/searchWorker/SearchDatastore';

function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(r => {
		resolve = r;
	});
	return { promise, resolve };
}

function file(path: string): TFile {
	const basename = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
	return Object.assign(new ObsidianTFile(), { path, basename, extension: 'md' }) as TFile;
}

class FakeOwnerStore<T> {
	replaceAllOwnersCalls: Map<string, SearchRecord<SearchDatum<T>>[]>[] = [];

	async replaceAllOwners(ownerRecords: Map<string, SearchRecord<SearchDatum<T>>[]>): Promise<void> {
		this.replaceAllOwnersCalls.push(ownerRecords);
	}

	async replaceOwner(): Promise<void> {}
}

class FakeFullTextStore {
	activeBulkLoads = 0;
	maxActiveBulkLoads = 0;
	beginCalls = 0;
	finishCalls = 0;
	clearCalls = 0;
	replaceOwnersCalls: Map<string, SearchRecord<SearchDatum<FullTextBlockMeta>>[]>[] = [];
	blockNextReplaceOwners?: { entered: () => void; release: Promise<void> };

	async beginBulkLoad(): Promise<void> {
		this.beginCalls += 1;
		this.activeBulkLoads += 1;
		this.maxActiveBulkLoads = Math.max(this.maxActiveBulkLoads, this.activeBulkLoads);
	}

	async finishBulkLoad(): Promise<void> {
		this.finishCalls += 1;
		this.activeBulkLoads = Math.max(0, this.activeBulkLoads - 1);
	}

	async clear(): Promise<void> {
		this.clearCalls += 1;
		this.activeBulkLoads = 0;
	}

	async replaceOwners(ownerRecords: Map<string, SearchRecord<SearchDatum<FullTextBlockMeta>>[]>): Promise<void> {
		this.replaceOwnersCalls.push(ownerRecords);
		const blocker = this.blockNextReplaceOwners;
		if (blocker) {
			this.blockNextReplaceOwners = undefined;
			blocker.entered();
			await blocker.release;
		}
	}

	async replaceOwner(): Promise<void> {}
}

function createPlugin(
	files: TFile[],
	contents: Record<string, string>,
): {
	getFiles: () => TFile[];
	settings: { ignoreExcludedFiles: boolean };
	app: {
		vault: { cachedRead: (f: TFile) => Promise<string> };
		metadataCache: { getFileCache: (f: TFile) => CachedMetadata | undefined; isUserIgnored: () => boolean };
	};
	registerEvent: (_ref: EventRef) => void;
} {
	return {
		getFiles: () => files,
		settings: { ignoreExcludedFiles: false },
		app: {
			vault: {
				cachedRead: async (f: TFile) => contents[f.path] ?? '',
			},
			metadataCache: {
				getFileCache: () => undefined,
				isUserIgnored: () => false,
			},
		},
		registerEvent: () => {},
	};
}

describe('BuiltInSearchIndexer full-text rebuilds', () => {
	test('serializes overlapping rebuild requests', async () => {
		const note = file('note.md');
		const fullText = new FakeFullTextStore();
		const entered = deferred();
		const release = deferred();
		fullText.blockNextReplaceOwners = {
			entered: () => entered.resolve(undefined),
			release: release.promise,
		};
		const indexer = new BuiltInSearchIndexer(
			createPlugin([note], { [note.path]: 'Alpha beta' }) as never,
			{
				filePath: new FakeOwnerStore<TFile>() as never,
				fileAlias: new FakeOwnerStore<TFile>() as never,
				fullText: fullText as never,
			},
			{},
			new FullTextRecordIds(),
		);

		const first = indexer.rebuild();
		await entered.promise;
		const second = indexer.rebuild();
		await Promise.resolve();

		expect(fullText.maxActiveBulkLoads).toBe(1);

		release.resolve(undefined);
		await Promise.all([first, second]);

		expect(fullText.maxActiveBulkLoads).toBe(1);
		expect(fullText.activeBulkLoads).toBe(0);
		expect(fullText.finishCalls).toBeGreaterThan(0);
	});

	test('clears an aborted bulk load before retrying a newer generation', async () => {
		const note = file('note.md');
		const fullText = new FakeFullTextStore();
		const entered = deferred();
		const release = deferred();
		fullText.blockNextReplaceOwners = {
			entered: () => entered.resolve(undefined),
			release: release.promise,
		};
		const indexer = new BuiltInSearchIndexer(
			createPlugin([note], { [note.path]: 'Alpha beta' }) as never,
			{
				filePath: new FakeOwnerStore<TFile>() as never,
				fileAlias: new FakeOwnerStore<TFile>() as never,
				fullText: fullText as never,
			},
			{},
			new FullTextRecordIds(),
		);

		const first = indexer.rebuild();
		await entered.promise;
		const second = indexer.rebuild();
		release.resolve(undefined);
		await Promise.all([first, second]);

		expect(fullText.clearCalls).toBeGreaterThan(0);
		expect(fullText.activeBulkLoads).toBe(0);
	});

	test('keeps old compact full-text ids hydratable across rebuilds', async () => {
		const oldNote = file('old.md');
		const newNote = file('new.md');
		const recordIds = new FullTextRecordIds();
		const oldId = recordIds.recordId(oldNote.path, 0, 5);
		const files = [newNote];
		const indexer = new BuiltInSearchIndexer(
			createPlugin(files, { [newNote.path]: 'Gamma' }) as never,
			{
				filePath: new FakeOwnerStore<TFile>() as never,
				fileAlias: new FakeOwnerStore<TFile>() as never,
				fullText: new FakeFullTextStore() as never,
			},
			{},
			recordIds,
		);

		await indexer.rebuild();

		expect(recordIds.parse(oldId)).toEqual({
			filePath: oldNote.path,
			startOffset: 0,
			endOffset: 5,
		});
	});
});
