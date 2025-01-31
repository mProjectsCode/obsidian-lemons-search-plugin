import type { Modifier, Scope } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import type { NiceSearchResult, SearchData } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';

export interface SearchUI<T> {
	create(
		plugin: LemonsSearchPlugin,
		targetEl: HTMLElement,
		scope: Scope,
		search: (s: string) => void,
		onSubmit: (data: SearchData<T>, modifiers: Modifier[]) => void,
		onCancel: () => void,
	): void;

	onSearchResults(results: NiceSearchResult<T>[]): void;

	destroy(): void;
}
