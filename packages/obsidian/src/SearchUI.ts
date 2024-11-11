import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { RPCController } from 'packages/obsidian/src/rpc/RPC';
import SearchUIComponent from 'packages/obsidian/src/searchUI/SearchUIComponent.svelte';
// @ts-expect-error
import SearchWorker from 'packages/obsidian/src/searchWorker/search.worker';
import type { SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker, SearchResult } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
import { mount, unmount } from 'svelte';

export class SearchUI {
	plugin: LemonsSearchPlugin;
	uuid: string;

	worker: Worker;
	targetEl: HTMLElement;
	onCancel: () => void;
	RPC: RPCController<SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker>;

	searchQueueSlot: string | undefined;
	searchWorkerRunning: boolean = false;
	searchWorkerResult: SearchResult[] | undefined;
	searchWorkerNewData: boolean = false;
	searchWorkerInitialized: boolean = false;

	searchComponent: ReturnType<typeof SearchUIComponent>;

	constructor(plugin: LemonsSearchPlugin, targetEl: HTMLElement, onCancel: () => void) {
		this.plugin = plugin;
		this.targetEl = targetEl;
		this.onCancel = onCancel;

		this.uuid = crypto.randomUUID();

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		this.worker = new SearchWorker() as Worker;

		this.RPC = new RPCController<SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker>(
			{
				onSearchFinished: (result): void => this.onSearchFinished(result),
				onInitialized: (): void => {
					this.searchWorkerInitialized = true;
					this.RPC.call('updateIndex', this.plugin.getFilePaths());
					this.startSearch();
				},
			},
			(m): void => this.worker.postMessage(m),
		);

		this.worker.onmessage = (e): void => {
			this.RPC.handle(e.data);
		};

		this.plugin.registerSearchUI(this);

		// this.plugin.rustPlugin.create_search_ui(targetEl, () => this.onCancel(), this);
		this.searchComponent = mount(SearchUIComponent, {
			target: targetEl,
			props: {
				search: this,
				plugin: this.plugin,
				closeSearch: () => this.onCancel(),
			},
		});
	}

	search(path: string): void {
		this.searchQueueSlot = path;

		this.startSearch();
	}

	startSearch(): void {
		// console.log('startSearch', this.searchQueueSlot, this.searchWorkerRunning);

		if (this.searchQueueSlot === undefined || this.searchWorkerRunning || !this.searchWorkerInitialized) {
			return;
		}

		this.searchWorkerRunning = true;
		this.RPC.call('search', this.searchQueueSlot);
		this.searchQueueSlot = undefined;
	}

	onSearchFinished(result: SearchResult[]): void {
		// console.log('onSearchFinished', result);

		this.searchWorkerRunning = false;
		this.searchWorkerResult = result;
		this.searchWorkerNewData = true;

		this.startSearch();
	}

	hasResults(): boolean {
		return this.searchWorkerNewData && this.searchWorkerResult !== undefined;
	}

	getResults(): SearchResult[] {
		this.searchWorkerNewData = false;
		return this.searchWorkerResult!;
	}

	destroy(): void {
		this.plugin.unregisterSearchUI(this);
		this.worker.terminate();
		unmount(this.searchComponent);
		this.targetEl.empty();
	}
}
