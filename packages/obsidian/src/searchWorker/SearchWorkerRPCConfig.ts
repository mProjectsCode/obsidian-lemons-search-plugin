/* eslint-disable */
// eslint turns them into interfaces which causes TS errors

export type SearchWorkerRPCHandlersWorker = {
	updateIndex: [string[]];
	onFileCreate: [string];
	onFileDelete: [string];
	onFileRename: [string, string];

	search: [string];
};

export type SearchWorkerRPCHandlersMain = {
	onSearchFinished: [SearchResult[]];
	onInitialized: [];
};

export interface SearchResult {
	path: string;
	highlights: { text: string; highlight: boolean }[];
}
