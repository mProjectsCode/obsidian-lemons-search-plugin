import type { Modifier, Scope } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import type { SearchDatastore } from 'packages/obsidian/src/searchWorker/SearchDatastore';
import type { SearchSession } from 'packages/obsidian/src/searchWorker/SearchSession';

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

export interface HighlightSegment {
	// text
	t: string;
	// whether the text is highlighted
	h: boolean;
}

/**
 * A search datum with highlights.
 */
export type SearchResultDatum<T> = SearchDatum<T> & {
	highlights?: HighlightSegment[];
	highlightRanges?: Uint32Array | number[];
};

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

	targetEl?: HTMLElement;
	onSubmitCBs: ((data: SearchDatum<T>, modifiers: Modifier[]) => void)[];
	onCancelCBs: (() => void)[];
	data: SearchData<T>;
	store: SearchDatastore<T>;
	destroyStoreOnDestroy: boolean;
	session?: SearchSession<T>;
	ui: SearchUI<T>;

	searchQueueSlot: string | undefined;
	searchInFlight: boolean = false;
	sessionReady: boolean = false;
	sessionFailed: boolean = false;
	searchGeneration: number = 0;
	destroyed: boolean = false;

	constructor(plugin: LemonsSearchPlugin, ui: SearchUI<T>, data: SearchData<T>, store: SearchDatastore<T>, destroyStoreOnDestroy: boolean = false) {
		this.plugin = plugin;
		this.onSubmitCBs = [];
		this.onCancelCBs = [];
		this.data = data;
		this.store = store;
		this.destroyStoreOnDestroy = destroyStoreOnDestroy;
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
		this.destroyed = false;
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

		void this.store
			.createSession()
			.then(session => {
				if (this.destroyed) {
					void session.close();
					return;
				}
				this.session = session;
				this.sessionReady = true;
				this.startSearch();
			})
			.catch(e => {
				this.sessionFailed = true;
				this.sessionReady = false;
				this.searchInFlight = false;
				this.searchQueueSlot = undefined;
				this.ui.onSearchResults([]);
				console.error('Failed to create Lemons Search session:', e);
			});
	}

	search(s: string): void {
		this.searchQueueSlot = s;

		this.startSearch();
	}

	startSearch(): void {
		// if there is no search in the queue, we have nothing to do
		// if the session is not initialized, we cannot start a search
		// if a search is already running, a new search will be started when the current search is finished
		const session = this.session;
		if (this.searchQueueSlot === undefined || this.searchInFlight || !this.sessionReady || this.sessionFailed || !session) {
			return;
		}

		this.searchInFlight = true;
		const query = this.searchQueueSlot;
		this.searchQueueSlot = undefined;
		const generation = ++this.searchGeneration;
		void session
			.search(query)
			.then(results => {
				if (!this.destroyed && generation === this.searchGeneration) {
					this.onSearchFinished(results);
				}
			})
			.catch(e => {
				this.searchInFlight = false;
				this.ui.onSearchResults([]);
				console.error('Lemons Search query failed:', e);
				this.startSearch();
			});
	}

	/**
	 * This is called when the current search is finished.
	 * It will start a new search if there is a new search in the queue.
	 */
	onSearchFinished(result: SearchResultDatum<T>[]): void {
		this.searchInFlight = false;

		this.ui.onSearchResults(result);

		this.startSearch();
	}

	destroy(): void {
		this.destroyed = true;
		this.searchGeneration += 1;
		void this.session?.close().catch(e => {
			console.error('Failed to close Lemons Search session:', e);
		});
		if (this.destroyStoreOnDestroy) {
			void this.store.destroy().catch(e => {
				console.error('Failed to destroy Lemons Search datastore:', e);
			});
		}
		this.ui.destroy();
		this.targetEl?.empty();
	}
}
