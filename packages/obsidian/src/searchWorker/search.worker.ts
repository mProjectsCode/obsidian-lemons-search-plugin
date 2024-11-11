import type { InitInput } from 'packages/lemons-search/pkg/lemons_search';
import init, { setup, Search } from 'packages/lemons-search/pkg/lemons_search';
import { RPCController } from 'packages/obsidian/src/rpc/RPC';
import type { SearchResult, SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
import wasmbin from '../../../lemons-search/pkg/lemons_search_bg.wasm';

let search: Search | undefined = undefined;

const RPC = new RPCController<SearchWorkerRPCHandlersWorker, SearchWorkerRPCHandlersMain>(
	{
		onFileCreate(name): void {
			search?.add_file(name);
		},
		onFileDelete(name): void {
			search?.remove_file(name);
		},
		onFileRename(oldName, newName): void {
			search?.rename_file(oldName, newName);
		},
		updateIndex(files): void {
			search?.update_index(files);
		},
		search(query): void {
			if (!search) return;

			const result = search.search(query) as SearchResult[];
			RPC.call('onSearchFinished', result);
		},
	},
	m => postMessage(m),
);

void init(wasmbin as unknown as InitInput).then(() => {
	setup();

	search = new Search();

	// console.log('search worker initialized');

	RPC.call('onInitialized');
});

onmessage = (e): void => {
	RPC.handle(e.data);
};
