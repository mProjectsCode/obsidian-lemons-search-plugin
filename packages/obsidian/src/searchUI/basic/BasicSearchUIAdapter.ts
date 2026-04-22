import SearchComponent from 'packages/obsidian/src/searchUI/SearchComponent.svelte';
import type { SearchResultDatum, SearchUIProps } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import { mount, unmount } from 'svelte';

interface SearchComponentExports<T> {
	onSearchResults(results: SearchResultDatum<T>[]): void;
}

/**
 * Adapter for the basic search UI.
 */
export class BasicSearchUIAdapter<T> implements SearchUI<T> {
	component?: SearchComponentExports<T>;
	prompt: string;

	constructor(prompt: string) {
		this.prompt = prompt;
	}

	create(props: SearchUIProps<T>): void {
		this.component = mount(SearchComponent, {
			target: props.targetEl,
			props: {
				...props,
				prompt: this.prompt,
				cssClasses: 'prompt lemons-search',
			},
		}) as SearchComponentExports<T>;
	}

	destroy(): void {
		if (this.component) {
			void unmount(this.component);
		}
	}

	onSearchResults(results: SearchResultDatum<T>[]): void {
		this.component?.onSearchResults(results);
	}
}
