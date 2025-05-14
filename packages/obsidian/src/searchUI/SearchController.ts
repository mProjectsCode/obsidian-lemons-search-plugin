import type { Modifier, Scope } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { RPCController } from 'packages/obsidian/src/rpc/RPC';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import type { SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
// @ts-expect-error
// eslint-disable-next-line
import SearchWorker from 'packages/obsidian/src/searchWorker/search.worker';

export interface SearchData<T> {
	data: SearchDatum<T>[];
	placeholders: SearchPlaceholderCategory<T>[];
}

/**
 * A data point for the search.
 */
export interface SearchDatum<T> {
	/**
	 * The text that the search acts on.
	 */
	content: string;
	/**
	 * Smaller text to display below the highlighted content.
	 * This is not used in the search.
	 */
	subText?: string;
	/**
	 * Used to display the keyboard shortcut in the command palette.
	 */
	hotKeys?: string[];
	/**
	 * Some extra data associated with the search datum.
	 * This is passed to the `onSubmit` callback when the user selects the search datum.
	 */
	data: T;
}

/**
 * A search datum with highlights.
 */
export type SearchResultDatum<T> = SearchDatum<T> & {
	highlights?: { text: string; highlight: boolean }[];
};

/**
 * A search result returned by Rust.
 * To minimize the amount of data that is transferred between the worker and the main thread,
 * we only send the index of the search datum and the highlights.
 */
export interface SearchResult {
	index: number;
	highlights: { text: string; highlight: boolean }[];
}

export interface SearchPlaceholderCategory<T> {
	title: string;
	data: SearchDatum<T>[];
}

export interface IndexedPlaceholderCategory {
	title: string;
	startIndex: number;
	endIndex: number;
}

export class IndexedPlaceholderCategories<T> {
	data: SearchDatum<T>[];
	categories: IndexedPlaceholderCategory[];

	constructor(data: SearchPlaceholderCategory<T>[]) {
		this.data = [];
		this.categories = [];

		let index = 0;
		for (const category of data) {
			this.categories.push({
				title: category.title,
				startIndex: index,
				endIndex: index + category.data.length,
			});
			index += category.data.length;
			this.data.push(...category.data);
		}
	}

	hasData(): boolean {
		return this.data.length > 0;
	}

	totalDataCount(): number {
		return this.data.length;
	}

	get(index: number): SearchDatum<T> | undefined {
		return this.data[index];
	}

	getDataForCategory(category: IndexedPlaceholderCategory): SearchDatum<T>[] {
		return this.data.slice(category.startIndex, category.endIndex);
	}
}

export interface SearchUIProps<T> {
	plugin: LemonsSearchPlugin;
	targetEl: HTMLElement;
	scope: Scope;
	placeholderData: SearchPlaceholderCategory<T>[];
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
