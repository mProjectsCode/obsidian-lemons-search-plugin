import PreviewSearchUI from 'packages/obsidian/src/searchUI/preview/PreviewSearchUI.svelte';
import type { SearchUIProps } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchResultDatum } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import { mount, unmount } from 'svelte';

/**
 * Adapter for the preview search UI.
 * Asserts that the data type is a string representing the vault relative file path.
 */
export class PreviewSearchUIAdapter implements SearchUI<string> {
	component?: ReturnType<typeof PreviewSearchUI>;
	prompt: string;

	constructor(prompt: string) {
		this.prompt = prompt;
	}

	create(props: SearchUIProps<string>): void {
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

	onSearchResults(results: SearchResultDatum<string>[]): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		this.component?.onSearchResults(results);
	}
}
