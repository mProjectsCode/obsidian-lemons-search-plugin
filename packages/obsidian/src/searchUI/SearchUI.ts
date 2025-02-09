import type { SearchResultDatum, SearchUIProps } from 'packages/obsidian/src/searchUI/SearchController';

export interface SearchUI<T> {
	create(props: SearchUIProps<T>): void;

	onSearchResults(results: SearchResultDatum<T>[]): void;

	destroy(): void;
}
