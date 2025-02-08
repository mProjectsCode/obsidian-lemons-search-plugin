import SearchComponent from 'packages/obsidian/src/searchUI/SearchComponent.svelte';
import type { FullSearchUIProps, SearchUIProps } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import type { NiceSearchResult } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
import { mount, unmount } from 'svelte';

/**
 * Adapter for the basic search UI.
 */
export class BasicSearchUIAdapter<T> implements SearchUI<T> {
	component?: ReturnType<typeof SearchComponent>;
	searchPlaceholder: string;

	constructor(searchPlaceholder: string) {
		this.searchPlaceholder = searchPlaceholder;
	}

	create(props: SearchUIProps<T>): void {
		this.component = mount(SearchComponent, {
			target: props.targetEl,
			props: {
				...props,
				searchPlaceholder: this.searchPlaceholder,
				cssClasses: 'prompt lemons-search',
			} as FullSearchUIProps<unknown>,
		});
	}

	destroy(): void {
		if (this.component) {
			void unmount(this.component);
		}
	}

	onSearchResults(results: NiceSearchResult<T>[]): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		this.component?.onSearchResults(results);
	}
}
