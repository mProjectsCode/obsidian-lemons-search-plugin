import type { SearchUIProps } from 'packages/obsidian/src/searchUI/SearchController';
import type { NiceSearchResult } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';

export interface SearchUI<T> {
	create(props: SearchUIProps<T>): void;

	onSearchResults(results: NiceSearchResult<T>[]): void;

	destroy(): void;
}
