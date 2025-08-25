import type { TFile } from 'obsidian';
import PreviewSearchUI from 'packages/obsidian/src/searchUI/preview/PreviewSearchUI.svelte';
import type { SearchUIProps } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchResultDatum } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import { mount, unmount } from 'svelte';

/**
 * Adapter for the preview search UI.
 * Asserts that the data type is a TFile representing the vault relative file path.
 */
export class PreviewSearchUIAdapter implements SearchUI<TFile> {
	component?: ReturnType<typeof PreviewSearchUI>;
	prompt: string;

	constructor(prompt: string) {
		this.prompt = prompt;
	}

	create(props: SearchUIProps<TFile>): void {
		this.component = mount(PreviewSearchUI, {
			target: props.targetEl,
			props: { ...props, prompt: this.prompt },
		});
	}

	destroy(): void {
		if (this.component) {
			void unmount(this.component);
		}
	}

	onSearchResults(results: SearchResultDatum<TFile>[]): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		this.component?.onSearchResults(results);
	}
}
