import init, { SearchEngine, setup } from '@lemons_dev/lemons-search';
import { RPCController } from 'packages/obsidian/src/rpc/RPC';
import type { SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';

interface SearchEngineInstance {
	set_max_results(maxResults: number): void;
	set_full_text_fuzzy_search?(enabled: boolean): void;
	create_datastore(kind: string): string;
	destroy_datastore(storeId: string): void;
	clear_datastore(storeId: string): void;
	begin_bulk_load(storeId: string): void;
	finish_bulk_load(storeId: string): void;
	upsert_records(storeId: string, records: unknown): void;
	delete_records(storeId: string, recordIds: string[]): void;
	delete_records_by_prefix(storeId: string, prefix: string): void;
	datastore_health(storeId: string): unknown;
	create_session(storeId: string): string;
	close_session(sessionId: string): void;
	search_session(sessionId: string, query: string): unknown;
}

let engine: SearchEngineInstance | undefined = undefined;

function resolve(requestId: string, value?: unknown): void {
	RPC.call('onRequestResolved', requestId, value);
}

function reject(requestId: string, error: unknown): void {
	const message = error instanceof Error ? error.message : String(error);
	RPC.call('onRequestFailed', requestId, message);
}

function withEngine<T>(requestId: string, cb: (engine: SearchEngineInstance) => T): void {
	try {
		if (!engine) {
			throw new Error('Search engine is not initialized');
		}
		resolve(requestId, cb(engine));
	} catch (e) {
		reject(requestId, e);
	}
}

	const RPC = new RPCController<SearchWorkerRPCHandlersWorker, SearchWorkerRPCHandlersMain>(
		{
			setMaxResults(maxResults): void {
				engine?.set_max_results(maxResults);
			},
			setFullTextFuzzySearch(enabled): void {
				engine?.set_full_text_fuzzy_search?.(enabled);
			},
			createDatastore(requestId, kind): void {
			withEngine(requestId, engine => engine.create_datastore(kind));
		},
		destroyDatastore(requestId, storeId): void {
			withEngine(requestId, engine => engine.destroy_datastore(storeId));
		},
		clearDatastore(requestId, storeId): void {
			withEngine(requestId, engine => engine.clear_datastore(storeId));
		},
		beginBulkLoad(requestId, storeId): void {
			withEngine(requestId, engine => engine.begin_bulk_load(storeId));
		},
		finishBulkLoad(requestId, storeId): void {
			withEngine(requestId, engine => engine.finish_bulk_load(storeId));
		},
		upsertRecords(requestId, storeId, records): void {
			withEngine(requestId, engine => engine.upsert_records(storeId, records));
		},
		deleteRecords(requestId, storeId, recordIds): void {
			withEngine(requestId, engine => engine.delete_records(storeId, recordIds));
		},
		deleteRecordsByPrefix(requestId, storeId, prefix): void {
			withEngine(requestId, engine => engine.delete_records_by_prefix(storeId, prefix));
		},
		getDatastoreHealth(requestId, storeId): void {
			withEngine(requestId, engine => engine.datastore_health(storeId));
		},
		createSession(requestId, storeId): void {
			withEngine(requestId, engine => engine.create_session(storeId));
		},
		closeSession(requestId, sessionId): void {
			withEngine(requestId, engine => engine.close_session(sessionId));
		},
		searchSession(requestId, sessionId, query): void {
			withEngine(requestId, engine => engine.search_session(sessionId, query));
		},
	},
	m => postMessage(m),
);

void init()
	.then(() => {
		setup();
		engine = new SearchEngine();

		// console.log('search worker initialized');

		RPC.call('onInitialized');
	})
	.catch((e: unknown) => {
		const message = e instanceof Error ? e.message : String(e);
		RPC.call('onInitializationFailed', message);
	});

onmessage = (e): void => {
	RPC.handle(e.data);
};
