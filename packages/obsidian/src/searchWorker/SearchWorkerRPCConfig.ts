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
	onSearchFinished: [Uint8Array];
	onInitialized: [];
};