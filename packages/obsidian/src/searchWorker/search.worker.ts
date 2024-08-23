import init, { type InitInput, setup, Search } from '../../../lemons-search/pkg/lemons_search';
import wasmbin from '../../../lemons-search/pkg/lemons_search_bg.wasm';
import { type SearchWorkerRPCHandlersMain, type SearchWorkerRPCHandlersWorker } from './SearchWorkerRPCConfig';
import { RPCController } from '../rpc/RPC';

let search: Search | undefined = undefined;

const RPC = new RPCController<SearchWorkerRPCHandlersWorker, SearchWorkerRPCHandlersMain>(
	{
		onFileCreate(name) {
			search?.add_file(name);
		},
		onFileDelete(name) {
			search?.remove_file(name);
		},
		onFileRename(oldName, newName) {
			search?.rename_file(oldName, newName);
		},
		updateIndex(files) {
			search?.update_index(files);
		},
		search(query) {
			if (!search) return;

			const result = search.search(query);
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

onmessage = e => {
	RPC.handle(e.data);
};
