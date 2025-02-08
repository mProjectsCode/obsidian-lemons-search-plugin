import PreviewSearchUI from 'packages/obsidian/src/searchUI/preview/PreviewSearchUI.svelte';
import type { SearchUIProps } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import type { NiceSearchResult } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
import { mount, unmount } from 'svelte';

/**
 * Adapter for the preview search UI.
 * Asserts that the data type is a string representing the vault relative file path.
 */
export class PreviewSearchUIAdapter implements SearchUI<string> {
	component?: ReturnType<typeof PreviewSearchUI>;
	searchPlaceholder: string;

	constructor(searchPlaceholder: string) {
		this.searchPlaceholder = searchPlaceholder;
	}

	create(props: SearchUIProps<string>): void {
		this.component = mount(PreviewSearchUI, {
			target: props.targetEl,
			props: { ...props, searchPlaceholder: this.searchPlaceholder },
		});
	}

	destroy(): void {
		if (this.component) {
			void unmount(this.component);
		}
	}

	onSearchResults(results: NiceSearchResult<string>[]): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		this.component?.onSearchResults(results);
	}
}
