export type DatastoreKind = 'fuzzy' | 'fullText';

export interface WorkerSearchRecord {
	id: string;
	text: string;
}

export interface WorkerSearchResult {
	id: string;
	score: number;
	r: Uint32Array | number[];
}

export interface WorkerDatastoreHealth {
	exists: boolean;
	kind: DatastoreKind | '';
	liveRecords: number;
	tombstones: number;
	recordIds: string[];
	postingTerms: number;
	postingOccurrences: number;
}

export interface SearchWorkerRPCHandlersWorker {
	setMaxResults: [number];
	createDatastore: [string, DatastoreKind];
	destroyDatastore: [string, string];
	clearDatastore: [string, string];
	beginBulkLoad: [string, string];
	finishBulkLoad: [string, string];
	upsertRecords: [string, string, WorkerSearchRecord[]];
	deleteRecords: [string, string, string[]];
	deleteRecordsByPrefix: [string, string, string];
	getDatastoreHealth: [string, string];
	createSession: [string, string];
	closeSession: [string, string];
	searchSession: [string, string, string];
}

export interface SearchWorkerRPCHandlersMain {
	onRequestResolved: [string, unknown];
	onRequestFailed: [string, string];
	onInitialized: [];
	onInitializationFailed: [string];
}
