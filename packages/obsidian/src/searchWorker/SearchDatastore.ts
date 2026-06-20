import type { SearchDatum, SearchResultDatum } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchService } from 'packages/obsidian/src/searchWorker/SearchService';
import { SearchSession } from 'packages/obsidian/src/searchWorker/SearchSession';
import type { DatastoreKind, WorkerDatastoreHealth, WorkerSearchRecord } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
import { AsyncSerialQueue, Deferred } from 'packages/obsidian/src/utils/async';

export interface SearchRecord<TMeta = unknown> {
	id: string;
	text: string;
	meta?: TMeta;
}

export interface SearchDatastoreHealth extends WorkerDatastoreHealth {
	jsRecords: number;
	jsOwners: number;
	missingMetadata: string[];
	staleMetadata: string[];
	healthy: boolean;
}

export type SearchResultHydrator<T> = (
	result: SearchResultHydrationInput<T>,
	query: string,
	highlightRanges: Uint32Array | number[] | undefined,
) => Promise<SearchResultDatum<T> | undefined>;

export interface SearchResultHydrationInput<T> {
	id: string;
	datum?: SearchDatum<T>;
}

export type RecordMetadataStrategy<T> = { type: 'stored'; hydrateResult?: SearchResultHydrator<T> } | { type: 'none'; hydrateResult: SearchResultHydrator<T> };
export type OwnerRecordDeletionStrategy = { type: 'tracked-records' } | { type: 'record-id-prefix'; getPrefix: (ownerId: string) => string | undefined };

export interface SearchDatastoreOptions<T> {
	metadataStrategy?: RecordMetadataStrategy<T>;
	ownerDeletionStrategy?: OwnerRecordDeletionStrategy;
}

export type SearchDatastoreConstructorArg<T> = SearchResultHydrator<T> | SearchDatastoreOptions<T>;

interface NormalizedSearchDatastoreOptions<T> {
	metadataStrategy: RecordMetadataStrategy<T>;
	ownerDeletionStrategy: OwnerRecordDeletionStrategy;
}

function normalizeOptions<T>(options?: SearchDatastoreConstructorArg<T>): NormalizedSearchDatastoreOptions<T> {
	if (typeof options === 'function') {
		return {
			metadataStrategy: { type: 'stored', hydrateResult: options },
			ownerDeletionStrategy: { type: 'tracked-records' },
		};
	}
	return {
		metadataStrategy: options?.metadataStrategy ?? { type: 'stored' },
		ownerDeletionStrategy: options?.ownerDeletionStrategy ?? { type: 'tracked-records' },
	};
}

function defaultHydrateResult<T>(datum: SearchDatum<T> | undefined, highlightRanges: Uint32Array | number[] | undefined): SearchResultDatum<T> | undefined {
	if (!datum) {
		return undefined;
	}
	return { ...datum, highlightRanges };
}

export class SearchDatastore<T> {
	readonly id: string;
	readonly kind: DatastoreKind;
	private service: SearchService;
	private metadataStrategy: RecordMetadataStrategy<T>;
	private ownerDeletionStrategy: OwnerRecordDeletionStrategy;
	private data = new Map<string, SearchDatum<T>>();
	private ownerRecords = new Map<string, Set<string>>();
	private mutations = new AsyncSerialQueue(error => {
		console.error('Lemons Search datastore mutation failed:', error);
	});
	private bulkLoad?: Deferred<void>;

	constructor(service: SearchService, id: string, kind: DatastoreKind, options?: SearchDatastoreConstructorArg<T>) {
		const normalizedOptions = normalizeOptions(options);
		this.service = service;
		this.id = id;
		this.kind = kind;
		this.metadataStrategy = normalizedOptions.metadataStrategy;
		this.ownerDeletionStrategy = normalizedOptions.ownerDeletionStrategy;
	}

	getDatum(id: string): SearchDatum<T> | undefined {
		return this.data.get(id);
	}

	getAllData(): SearchDatum<T>[] {
		return Array.from(this.data.values());
	}

	async getSearchResult(id: string, query: string, highlightRanges: Uint32Array | number[] | undefined): Promise<SearchResultDatum<T> | undefined> {
		const datum = this.data.get(id);
		if (this.metadataStrategy.hydrateResult) {
			return await this.metadataStrategy.hydrateResult({ id, datum }, query, highlightRanges);
		}
		return defaultHydrateResult(datum, highlightRanges);
	}

	async clear(): Promise<void> {
		await this.enqueueMutation(async () => {
			await this.service.clearDatastore(this.id);
			this.clearLocalRecords();
			this.resolveActiveBulkLoad();
		});
	}

	async beginBulkLoad(): Promise<void> {
		await this.enqueueMutation(async () => {
			this.ensureBulkLoadPromise();
			try {
				await this.service.beginBulkLoad(this.id);
				this.clearLocalRecords();
			} catch (e) {
				this.resolveActiveBulkLoad();
				throw e;
			}
		});
	}

	async finishBulkLoad(): Promise<void> {
		await this.enqueueMutation(async () => {
			try {
				await this.service.finishBulkLoad(this.id);
			} catch (e) {
				await this.service.clearDatastore(this.id);
				this.clearLocalRecords();
				throw e;
			} finally {
				this.resolveActiveBulkLoad();
			}
		});
	}

	async destroy(): Promise<void> {
		await this.enqueueMutation(async () => {
			await this.service.destroyDatastore(this.id);
			this.clearLocalRecords();
			this.resolveActiveBulkLoad();
		});
	}

	async upsert(records: SearchRecord<SearchDatum<T>>[]): Promise<void> {
		await this.enqueueMutation(async () => {
			await this.service.upsertRecords(this.id, this.toWorkerRecords(records));
			this.storeRecordMetadata(records);
		});
	}

	async delete(recordIds: string[]): Promise<void> {
		await this.enqueueMutation(async () => {
			await this.service.deleteRecords(this.id, recordIds);
			this.deleteMetadata(recordIds);
			if (!this.tracksOwnerRecords()) {
				return;
			}
			const deletedIds = new Set(recordIds);
			for (const [ownerId, ownerIds] of this.ownerRecords) {
				for (const id of deletedIds) {
					ownerIds.delete(id);
				}
				if (ownerIds.size === 0) {
					this.ownerRecords.delete(ownerId);
				}
			}
		});
	}

	async replaceOwner(ownerId: string, records: SearchRecord<SearchDatum<T>>[]): Promise<void> {
		await this.enqueueMutation(async () => {
			const deletedIds = await this.deleteOwnerRecords(ownerId, records);
			await this.service.upsertRecords(this.id, this.toWorkerRecords(records));

			this.deleteMetadata(deletedIds);
			this.storeOwnerRecordIds(ownerId, records);
			this.storeRecordMetadata(records);
		});
	}

	async replaceOwners(ownerRecords: Map<string, SearchRecord<SearchDatum<T>>[]>): Promise<void> {
		await this.enqueueMutation(async () => {
			const deletedIds: string[] = [];
			const records = Array.from(ownerRecords.values()).flat();

			for (const [ownerId, ownerRecordList] of ownerRecords) {
				deletedIds.push(...(await this.deleteOwnerRecords(ownerId, ownerRecordList)));
			}
			await this.service.upsertRecords(this.id, this.toWorkerRecords(records));

			this.deleteMetadata(deletedIds);
			for (const [ownerId, ownerRecordList] of ownerRecords) {
				this.storeOwnerRecordIds(ownerId, ownerRecordList);
				this.storeRecordMetadata(ownerRecordList);
			}
		});
	}

	async replaceAllOwners(ownerRecords: Map<string, SearchRecord<SearchDatum<T>>[]>): Promise<void> {
		await this.enqueueMutation(async () => {
			const records = Array.from(ownerRecords.values()).flat();

			await this.service.beginBulkLoad(this.id);
			try {
				await this.service.upsertRecords(this.id, this.toWorkerRecords(records));
				await this.service.finishBulkLoad(this.id);
			} catch (e) {
				await this.service.clearDatastore(this.id);
				this.clearLocalRecords();
				throw e;
			}

			this.replaceLocalRecords(ownerRecords);
		});
	}

	async createSession(): Promise<SearchSession<T>> {
		await this.whenSettled();
		const sessionId = await this.service.createSession(this.id);
		return new SearchSession(this.service, this, sessionId);
	}

	async healthCheck(): Promise<SearchDatastoreHealth> {
		await this.whenSettled();
		const health = await this.service.getDatastoreHealth(this.id);
		const wasmIds = new Set(health.recordIds);
		const jsIds = new Set(this.data.keys());
		const missingMetadata = this.storesRecordMetadata() ? health.recordIds.filter(id => !jsIds.has(id)) : [];
		const staleMetadata = Array.from(jsIds).filter(id => !wasmIds.has(id));

		return {
			...health,
			jsRecords: this.data.size,
			jsOwners: this.ownerRecords.size,
			missingMetadata,
			staleMetadata,
			healthy:
				health.exists &&
				missingMetadata.length === 0 &&
				staleMetadata.length === 0 &&
				(!this.storesRecordMetadata() || health.liveRecords === this.data.size),
		};
	}

	async whenSettled(): Promise<void> {
		await this.mutations.whenIdle();
		if (this.bulkLoad) {
			await this.bulkLoad.promise;
			await this.mutations.whenIdle();
		}
	}

	private enqueueMutation(cb: () => Promise<void>): Promise<void> {
		return this.mutations.enqueue(cb);
	}

	private toWorkerRecords(records: SearchRecord<SearchDatum<T>>[]): WorkerSearchRecord[] {
		return records.map(record => ({ id: record.id, text: record.text }));
	}

	private toRecordIdSet(records: SearchRecord<SearchDatum<T>>[]): Set<string> {
		return new Set(records.map(record => record.id));
	}

	private storeOwnerRecordIds(ownerId: string, records: SearchRecord<SearchDatum<T>>[]): void {
		if (!this.tracksOwnerRecords()) {
			return;
		}
		this.ownerRecords.set(ownerId, this.toRecordIdSet(records));
	}

	private storeRecordMetadata(records: SearchRecord<SearchDatum<T>>[]): void {
		if (!this.storesRecordMetadata()) {
			return;
		}
		for (const record of records) {
			if (record.meta) {
				this.data.set(record.id, record.meta);
			}
		}
	}

	private deleteMetadata(recordIds: Iterable<string>): void {
		for (const id of recordIds) {
			this.data.delete(id);
		}
	}

	private clearLocalRecords(): void {
		this.data.clear();
		this.ownerRecords.clear();
	}

	private replaceLocalRecords(ownerRecords: Map<string, SearchRecord<SearchDatum<T>>[]>): void {
		const nextData = new Map<string, SearchDatum<T>>();
		const nextOwnerRecords = new Map<string, Set<string>>();

		for (const [ownerId, ownerRecordList] of ownerRecords) {
			if (this.tracksOwnerRecords()) {
				nextOwnerRecords.set(ownerId, this.toRecordIdSet(ownerRecordList));
			}
			if (this.storesRecordMetadata()) {
				for (const record of ownerRecordList) {
					if (record.meta) {
						nextData.set(record.id, record.meta);
					}
				}
			}
		}

		this.data = nextData;
		this.ownerRecords = nextOwnerRecords;
	}

	private async deleteOwnerRecords(ownerId: string, records: SearchRecord<SearchDatum<T>>[]): Promise<string[]> {
		if (this.ownerDeletionStrategy.type === 'record-id-prefix') {
			if (this.bulkLoad) {
				return [];
			}
			const prefix = this.ownerDeletionStrategy.getPrefix(ownerId);
			if (prefix) {
				await this.service.deleteRecordsByPrefix(this.id, prefix);
				this.deleteMetadataByPrefix(prefix);
			}
			return [];
		}

		const previousIds = Array.from(this.ownerRecords.get(ownerId) ?? []);
		const nextIds = this.toRecordIdSet(records);
		const deletedIds = previousIds.filter(id => !nextIds.has(id));

		if (deletedIds.length > 0) {
			await this.service.deleteRecords(this.id, deletedIds);
		}
		return deletedIds;
	}

	private tracksOwnerRecords(): boolean {
		return this.ownerDeletionStrategy.type === 'tracked-records';
	}

	private storesRecordMetadata(): boolean {
		return this.metadataStrategy.type === 'stored';
	}

	private deleteMetadataByPrefix(prefix: string): void {
		if (!this.storesRecordMetadata()) {
			return;
		}
		for (const id of this.data.keys()) {
			if (id.startsWith(prefix)) {
				this.data.delete(id);
			}
		}
	}

	private ensureBulkLoadPromise(): void {
		if (this.bulkLoad) {
			return;
		}
		this.bulkLoad = new Deferred<void>();
	}

	private resolveActiveBulkLoad(): void {
		this.bulkLoad?.resolve(undefined);
		this.bulkLoad = undefined;
	}
}
