import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { RPCController } from 'packages/obsidian/src/rpc/RPC';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
// @ts-expect-error
import SearchWorker from 'packages/obsidian/src/searchWorker/search.worker';
import type {
	SearchWorkerRPCHandlersMain,
	SearchWorkerRPCHandlersWorker,
	SearchResult,
	SearchData,
} from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';

export class SearchController<T> {
	plugin: LemonsSearchPlugin;
	uuid: string;

	worker?: Worker;
	targetEl?: HTMLElement;
	onSubmitCBs: ((data: SearchData<T>) => void)[];
	onCancelCBs: (() => void)[];
	RPC?: RPCController<SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker>;
	data: SearchData<T>[];
	ui: SearchUI<T>;

	searchQueueSlot: string | undefined;
	searchWorkerRunning: boolean = false;
	searchWorkerInitialized: boolean = false;

	// searchComponent: ReturnType<typeof SearchUIComponent>;

	constructor(plugin: LemonsSearchPlugin, ui: SearchUI<T>, data: SearchData<T>[]) {
		this.plugin = plugin;
		this.onSubmitCBs = [];
		this.onCancelCBs = [];
		this.data = data;
		this.ui = ui;

		this.uuid = crypto.randomUUID();
	}

	onSubmit(cb: (data: SearchData<T>) => void): void {
		this.onSubmitCBs.push(cb);
	}

	onCancel(cb: () => void): void {
		this.onCancelCBs.push(cb);
	}

	create(targetEl: HTMLElement): void {
		this.targetEl = targetEl;
		this.ui.create(
			this.plugin,
			this.targetEl,
			s => this.search(s),
			data => {
				this.onSubmitCBs.forEach(cb => cb(data));
			},
			() => {
				this.onCancelCBs.forEach(cb => cb());
			},
		);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		this.worker = new SearchWorker() as Worker;

		this.RPC = RPCController.toWorker<SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker>(this.worker, {
			onSearchFinished: (result): void => this.onSearchFinished(result),
			onInitialized: (): void => {
				this.searchWorkerInitialized = true;
				this.RPC?.call(
					'updateIndex',
					this.data.map(d => d.content),
				);
				this.startSearch();
			},
		});
	}

	search(s: string): void {
		this.searchQueueSlot = s;

		this.startSearch();
	}

	startSearch(): void {
		// if there is no search in the queue, we have nothing to do
		// if the worker is not initialized, we cannot start a search
		// if the worker is already running, a new search will be started when the current search is finished
		if (this.searchQueueSlot === undefined || this.searchWorkerRunning || !this.searchWorkerInitialized) {
			return;
		}

		this.searchWorkerRunning = true;
		this.RPC?.call('search', this.searchQueueSlot);
		this.searchQueueSlot = undefined;
	}

	/**
	 * This is called when the current search is finished.
	 * It will start a new search if there is a new search in the queue.
	 */
	onSearchFinished(result: SearchResult[]): void {
		this.searchWorkerRunning = false;

		this.ui.onSearchResults(
			result.map(r => ({
				data: this.data[r.index],
				highlights: r.highlights,
			})),
		);

		this.startSearch();
	}

	destroy(): void {
		this.worker?.terminate();
		// void unmount(this.searchComponent);
		this.ui.destroy();
		this.targetEl?.empty();
	}
}
