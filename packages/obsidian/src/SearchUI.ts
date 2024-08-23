import type LemonsSearchPlugin from './main';
import { type SearchWorkerRPCConfigMain, type SearchWorkerRPCConfigWorker } from './SearchWorkerRPCConfig';
import { WorkerRPC } from './WorkerRPC';

// @ts-expect-error
import SearchWorker from './search.worker';

export class SearchUI {
	plugin: LemonsSearchPlugin;
	uuid: string;

	worker: Worker;
	targetEl: HTMLElement;
	onCancel: () => void;
	RPC: WorkerRPC<SearchWorkerRPCConfigWorker, SearchWorkerRPCConfigMain>;

	searchQueueSlot: string | undefined;
	searchWorkerRunning: boolean = false;
	searchWorkerResult: Uint8Array | undefined;
	searchWorkerNewData: boolean = false;
	searchWorkerInitialized: boolean = false;

	constructor(plugin: LemonsSearchPlugin, targetEl: HTMLElement, onCancel: () => void) {
		this.plugin = plugin;
		this.targetEl = targetEl;
		this.onCancel = onCancel;

		this.uuid = crypto.randomUUID();

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		this.worker = new SearchWorker('worker.js') as Worker;

		this.RPC = new WorkerRPC<SearchWorkerRPCConfigWorker, SearchWorkerRPCConfigMain>(
			{
				onSearchFinished: result => this.onSearchFinished(result),
				onInitialized: () => {
					this.searchWorkerInitialized = true;
					this.RPC.call('updateIndex', this.plugin.getFilePaths());
					this.startSearch();
				},
			},
			m => this.worker.postMessage(m),
		);

		this.worker.onmessage = e => {
			this.RPC.onMessage(e.data);
		};

		this.plugin.registerSearchUI(this);

		this.plugin.rustPlugin.create_search_ui(targetEl, () => this.onCancel(), this, this);
	}

	push(path: string): void {
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

	onSearchFinished(result: Uint8Array): void {
		// console.log('onSearchFinished', result);

		this.searchWorkerRunning = false;
		this.searchWorkerResult = result;
		this.searchWorkerNewData = true;

		this.startSearch();
	}

	hasData(): boolean {
		return this.searchWorkerNewData && this.searchWorkerResult !== undefined;
	}

	getData(): Uint8Array {
		this.searchWorkerNewData = false;
		return this.searchWorkerResult!;
	}

	destroy(): void {
		this.plugin.unregisterSearchUI(this);
		this.worker.terminate();
		this.targetEl.innerHTML = '';
	}
}
