import type { SearchDatum, SearchResultDatum } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchService } from 'packages/obsidian/src/searchWorker/SearchService';
import type { DatastoreKind, WorkerDatastoreHealth } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';

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

export class SearchDatastore<T> {
	readonly id: string;
	readonly kind: DatastoreKind;
	private service: SearchService;
	private data = new Map<string, SearchDatum<T>>();
	private ownerRecords = new Map<string, Set<string>>();
	private mutationQueue: Promise<void> = Promise.resolve();

	constructor(service: SearchService, id: string, kind: DatastoreKind) {
		this.service = service;
		this.id = id;
		this.kind = kind;
	}

	getDatum(id: string): SearchDatum<T> | undefined {
		return this.data.get(id);
	}

	getAllData(): SearchDatum<T>[] {
		return Array.from(this.data.values());
	}

	async clear(): Promise<void> {
		await this.enqueueMutation(async () => {
			await this.service.clearDatastore(this.id);
			this.data.clear();
			this.ownerRecords.clear();
		});
	}

	async destroy(): Promise<void> {
		await this.enqueueMutation(async () => {
			await this.service.destroyDatastore(this.id);
			this.data.clear();
			this.ownerRecords.clear();
		});
	}

	async upsert(records: SearchRecord<SearchDatum<T>>[]): Promise<void> {
		await this.enqueueMutation(async () => {
			await this.service.upsertRecords(
				this.id,
				records.map(record => ({ id: record.id, text: record.text })),
			);
			for (const record of records) {
				if (record.meta) {
					this.data.set(record.id, record.meta);
				}
			}
		});
	}

	async delete(recordIds: string[]): Promise<void> {
		await this.enqueueMutation(async () => {
			await this.service.deleteRecords(this.id, recordIds);
			for (const id of recordIds) {
				this.data.delete(id);
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
			const previousIds = Array.from(this.ownerRecords.get(ownerId) ?? []);
			const nextIds = new Set(records.map(record => record.id));
			const deletedIds = previousIds.filter(id => !nextIds.has(id));

			if (deletedIds.length > 0) {
				await this.service.deleteRecords(this.id, deletedIds);
			}
			await this.service.upsertRecords(
				this.id,
				records.map(record => ({ id: record.id, text: record.text })),
			);

			for (const id of deletedIds) {
				this.data.delete(id);
			}
			this.ownerRecords.set(ownerId, nextIds);
			for (const record of records) {
				if (record.meta) {
					this.data.set(record.id, record.meta);
				}
			}
		});
	}

	async replaceAllOwners(ownerRecords: Map<string, SearchRecord<SearchDatum<T>>[]>): Promise<void> {
		await this.enqueueMutation(async () => {
			const nextData = new Map<string, SearchDatum<T>>();
			const nextOwnerRecords = new Map<string, Set<string>>();
			const records = Array.from(ownerRecords.values()).flat();

			await this.service.clearDatastore(this.id);
			await this.service.upsertRecords(
				this.id,
				records.map(record => ({ id: record.id, text: record.text })),
			);

			for (const [ownerId, ownerRecordList] of ownerRecords) {
				nextOwnerRecords.set(ownerId, new Set(ownerRecordList.map(record => record.id)));
				for (const record of ownerRecordList) {
					if (record.meta) {
						nextData.set(record.id, record.meta);
					}
				}
			}

			this.data = nextData;
			this.ownerRecords = nextOwnerRecords;
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
		const missingMetadata = health.recordIds.filter(id => !jsIds.has(id));
		const staleMetadata = Array.from(jsIds).filter(id => !wasmIds.has(id));

		return {
			...health,
			jsRecords: this.data.size,
			jsOwners: this.ownerRecords.size,
			missingMetadata,
			staleMetadata,
			healthy: health.exists && missingMetadata.length === 0 && staleMetadata.length === 0 && health.liveRecords === this.data.size,
		};
	}

	async whenSettled(): Promise<void> {
		await this.mutationQueue;
	}

	private enqueueMutation(cb: () => Promise<void>): Promise<void> {
		const run = this.mutationQueue.then(cb, cb);
		this.mutationQueue = run.catch(e => {
			console.error('Lemons Search datastore mutation failed:', e);
		});
		return run;
	}
}

export class SearchSession<T> {
	private service: SearchService;
	private store: SearchDatastore<T>;
	private id: string;

	constructor(service: SearchService, store: SearchDatastore<T>, id: string) {
		this.service = service;
		this.store = store;
		this.id = id;
	}

	async search(query: string): Promise<SearchResultDatum<T>[]> {
		await this.store.whenSettled();
		const results = await this.service.searchSession(this.id, query);
		return results.flatMap(result => {
			const datum = this.store.getDatum(result.id);
			if (!datum) {
				return [];
			}
			return [{ ...datum, highlightRanges: result.r }];
		});
	}

	async close(): Promise<void> {
		await this.service.closeSession(this.id);
	}
}
