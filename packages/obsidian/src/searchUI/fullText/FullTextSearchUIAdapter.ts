import FullTextSearchUI from 'packages/obsidian/src/searchUI/fullText/FullTextSearchUI.svelte';
import type { SearchUIProps } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchResultDatum } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import type { FullTextBlockMeta } from 'packages/obsidian/src/searchWorker/FullTextBlocks';
import { mount, unmount } from 'svelte';

interface FullTextSearchUIExports {
	onSearchResults(results: SearchResultDatum<FullTextBlockMeta>[]): void;
}

export class FullTextSearchUIAdapter implements SearchUI<FullTextBlockMeta> {
	component?: FullTextSearchUIExports;
	prompt: string;

	constructor(prompt: string) {
		this.prompt = prompt;
	}

	create(props: SearchUIProps<FullTextBlockMeta>): void {
		this.component = mount(FullTextSearchUI, {
			target: props.targetEl,
			props: { ...props, prompt: this.prompt },
		}) as FullTextSearchUIExports;
	}

	destroy(): void {
		if (this.component) {
			void unmount(this.component);
		}
	}

	onSearchResults(results: SearchResultDatum<FullTextBlockMeta>[]): void {
		this.component?.onSearchResults(results);
	}
}
