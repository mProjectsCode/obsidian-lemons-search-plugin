/* eslint-disable */
// eslint turns them into interfaces which causes TS errors

import type { SearchResult } from '../searchUI/SearchController';

export type SearchWorkerRPCHandlersWorker = {
	updateIndex: [string[]];

	search: [string];
};

export type SearchWorkerRPCHandlersMain = {
	onSearchFinished: [SearchResult[]];
	onInitialized: [];
};
