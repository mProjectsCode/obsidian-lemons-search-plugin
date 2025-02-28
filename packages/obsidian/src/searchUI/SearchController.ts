import type { Modifier, Scope } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { RPCController } from 'packages/obsidian/src/rpc/RPC';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
// @ts-expect-error
import SearchWorker from 'packages/obsidian/src/searchWorker/search.worker';
import type { SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker, SearchResult } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';

export interface SearchData<T> {
	data: SearchDatum<T>[];
	placeholders: SearchPlaceholderData<T>[];
}

/**
 * A data point for the search.
 */
export interface SearchDatum<T> {
	content: string;
	subText?: string;
	/**
	 * Used to display the keyboard shortcut in the command palette.
	 */
	hotKeys?: string[];
	data: T;
}

/**
 * A search datum with highlights.
 */
export type SearchResultDatum<T> = SearchDatum<T> & {
	highlights?: { text: string; highlight: boolean }[];
};

export interface SearchPlaceholderData<T> {
	title: string;
	data: SearchDatum<T>[];
}

export interface IndexedPlaceholderData<T> {
	title: string;
	data: {
		d: SearchDatum<T>;
		index: number;
	}[];
}

export function indexSearchPlaceholderData<T>(data: SearchPlaceholderData<T>[]): [SearchDatum<T>[], IndexedPlaceholderData<T>[]] {
	const indexedData = [];
	const flatData = [];

	for (const placeholder of data) {
		const indexedDatum: IndexedPlaceholderData<T> = {
			title: placeholder.title,
			data: [],
		};

		for (const searchData of placeholder.data) {
			indexedDatum.data.push({
				d: searchData,
				index: flatData.length,
			});
			flatData.push(searchData);
		}

		indexedData.push(indexedDatum);
	}

	return [flatData, indexedData];
}

export interface SearchUIProps<T> {
	plugin: LemonsSearchPlugin;
	targetEl: HTMLElement;
	scope: Scope;
	placeholderData: SearchPlaceholderData<T>[];
	search: (s: string) => void;
	onSubmit: (data: SearchDatum<T>, modifiers: Modifier[]) => void;
	onCancel: () => void;
}

export type FullSearchUIProps<T> = SearchUIProps<T> & {
	prompt: string;
	onSelectedElementChange?: (selected: T | undefined) => void;
	cssClasses?: string;
};

export class SearchController<T> {
	plugin: LemonsSearchPlugin;
	uuid: string;

	worker?: Worker;
	targetEl?: HTMLElement;
	onSubmitCBs: ((data: SearchDatum<T>, modifiers: Modifier[]) => void)[];
	onCancelCBs: (() => void)[];
	RPC?: RPCController<SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker>;
	data: SearchData<T>;
	ui: SearchUI<T>;

	searchQueueSlot: string | undefined;
	searchWorkerRunning: boolean = false;
	searchWorkerInitialized: boolean = false;

	// searchComponent: ReturnType<typeof SearchUIComponent>;

	constructor(plugin: LemonsSearchPlugin, ui: SearchUI<T>, data: SearchData<T>) {
		this.plugin = plugin;
		this.onSubmitCBs = [];
		this.onCancelCBs = [];
		this.data = data;
		this.ui = ui;

		this.uuid = crypto.randomUUID();
	}

	onSubmit(cb: (data: SearchDatum<T>, modifiers: Modifier[]) => void): void {
		this.onSubmitCBs.push(cb);
	}

	onCancel(cb: () => void): void {
		this.onCancelCBs.push(cb);
	}

	create(targetEl: HTMLElement, scope: Scope): void {
		this.targetEl = targetEl;
		this.ui.create({
			plugin: this.plugin,
			targetEl: this.targetEl,
			scope,
			placeholderData: this.data.placeholders,
			search: (s: string) => this.search(s),
			onSubmit: (data: SearchDatum<T>, modifiers: Modifier[]) => {
				this.onSubmitCBs.forEach(cb => cb(data, modifiers));
			},
			onCancel: () => {
				this.onCancelCBs.forEach(cb => cb());
			},
		});

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		this.worker = new SearchWorker() as Worker;

		this.RPC = RPCController.toWorker<SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker>(this.worker, {
			onSearchFinished: (result): void => this.onSearchFinished(result),
			onInitialized: (): void => {
				this.searchWorkerInitialized = true;
				this.RPC?.call(
					'updateIndex',
					this.data.data.map(d => d.content),
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
				...this.data.data[r.index],
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
