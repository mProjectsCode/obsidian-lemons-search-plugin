/* eslint-disable */
// eslint turns them into interfaces which causes TS errors

export type SearchWorkerRPCHandlersWorker = {
	updateIndex: [string[]];

	search: [string];
};

export type SearchWorkerRPCHandlersMain = {
	onSearchFinished: [SearchResult[]];
	onInitialized: [];
};

/**
 * A search result returned by Rust.
 */
export interface SearchResult {
	index: number;
	highlights: { text: string; highlight: boolean }[];
}
