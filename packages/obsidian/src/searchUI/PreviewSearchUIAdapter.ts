import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import PreviewSearchUI from 'packages/obsidian/src/searchUI/PreviewSearchUI.svelte';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import type { NiceSearchResult, SearchData } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
import { mount, unmount } from 'svelte';

export class PreviewSearchUIAdapter implements SearchUI<string> {
	component?: ReturnType<typeof PreviewSearchUI>;

	constructor() {}

	create(
		plugin: LemonsSearchPlugin,
		targetEl: HTMLElement,
		search: (s: string) => void,
		onSubmit: (data: SearchData<string>) => void,
		onCancel: () => void,
	): void {
		this.component = mount(PreviewSearchUI, {
			target: targetEl,
			props: {
				plugin,
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
