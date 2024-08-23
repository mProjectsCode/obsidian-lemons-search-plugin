/* eslint-disable */
// eslint turns them into interfaces which causes TS errors

export type SearchWorkerRPCConfigWorker = {
	updateIndex: [string[]];
	onFileCreate: [string];
	onFileDelete: [string];
	onFileRename: [string, string];

	search: [string];
};

export type SearchWorkerRPCConfigMain = {
	onSearchFinished: [Uint8Array];
	onInitialized: [];
};
