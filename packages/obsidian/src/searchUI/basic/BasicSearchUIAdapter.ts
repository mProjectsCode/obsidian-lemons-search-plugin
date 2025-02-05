import type { Modifier, Scope } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import BasicSearchUI from 'packages/obsidian/src/searchUI/basic/BasicSearchUI.svelte';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import type { NiceSearchResult, SearchData } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
import { mount, unmount } from 'svelte';

/**
 * Adapter for the basic search UI.
 */
export class BasicSearchUIAdapter<T> implements SearchUI<T> {
	component?: ReturnType<typeof BasicSearchUI>;
	searchPlaceholder: string;

	constructor(searchPlaceholder: string) {
		this.searchPlaceholder = searchPlaceholder;
	}

	create(
		plugin: LemonsSearchPlugin,
		targetEl: HTMLElement,
		scope: Scope,
		search: (s: string) => void,
		onSubmit: (data: SearchData<T>, modifiers: Modifier[]) => void,
		onCancel: () => void,
	): void {
		this.component = mount(BasicSearchUI, {
			target: targetEl,
			props: {
				plugin,
				scope,
				searchPlaceholder: this.searchPlaceholder,
				search,
				onSubmit: (data: unknown, modifiers: Modifier[]) => onSubmit(data as SearchData<T>, modifiers),
				onCancel,
			},
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
