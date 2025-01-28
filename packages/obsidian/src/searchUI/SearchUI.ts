import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import type { NiceSearchResult, SearchData } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';

export interface SearchUI<T> {
	create(plugin: LemonsSearchPlugin, targetEl: HTMLElement, search: (s: string) => void, onSubmit: (data: SearchData<T>) => void, onCancel: () => void): void;

	onSearchResults(results: NiceSearchResult<T>[]): void;

	destroy(): void;
}
