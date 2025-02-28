import SearchComponent from 'packages/obsidian/src/searchUI/SearchComponent.svelte';
import type { FullSearchUIProps, SearchResultDatum, SearchUIProps } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import { mount, unmount } from 'svelte';

/**
 * Adapter for the basic search UI.
 */
export class BasicSearchUIAdapter<T> implements SearchUI<T> {
	component?: ReturnType<typeof SearchComponent>;
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
			} as FullSearchUIProps<unknown>,
		});
	}

	destroy(): void {
		if (this.component) {
			void unmount(this.component);
		}
	}

	onSearchResults(results: SearchResultDatum<T>[]): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		this.component?.onSearchResults(results);
	}
}
