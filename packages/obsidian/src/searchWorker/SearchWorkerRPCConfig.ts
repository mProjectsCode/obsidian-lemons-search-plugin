import type { SearchResult } from 'packages/obsidian/src/searchUI/SearchController';

export interface SearchWorkerRPCHandlersWorker {
	setMaxResults: [number];
	updateIndex: [string[]];

	search: [string];
}

export interface SearchWorkerRPCHandlersMain {
	onSearchFinished: [SearchResult[]];
	onInitialized: [];
	onInitializationFailed: [string];
}
