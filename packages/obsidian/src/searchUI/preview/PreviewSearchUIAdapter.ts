import type { Modifier, Scope } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import PreviewSearchUI from 'packages/obsidian/src/searchUI/preview/PreviewSearchUI.svelte';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import type { NiceSearchResult, SearchData } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
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

	create(
		plugin: LemonsSearchPlugin,
		targetEl: HTMLElement,
		scope: Scope,
		search: (s: string) => void,
		onSubmit: (data: SearchData<string>, modifiers: Modifier[]) => void,
		onCancel: () => void,
	): void {
		this.component = mount(PreviewSearchUI, {
			target: targetEl,
			props: {
				plugin,
				scope,
				searchPlaceholder: this.searchPlaceholder,
				search,
				onSubmit,
				onCancel,
			},
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
