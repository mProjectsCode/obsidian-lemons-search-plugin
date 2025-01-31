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

export interface SearchResult {
	index: number;
	highlights: { text: string; highlight: boolean }[];
}

export interface SearchData<T> {
	content: string;
	subText?: string;
	/**
	 * Used to display the keyboard shortcut in the command palette.
	 */
	keys?: string[];
	data: T;
}

export interface NiceSearchResult<T> {
	data: SearchData<T>;
	highlights: { text: string; highlight: boolean }[];
}
