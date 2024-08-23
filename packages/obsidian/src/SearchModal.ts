import { Modal } from 'obsidian';
import type LemonsSearchPlugin from './main';
import { SearchUI } from './SearchUI';

export class SearchModal extends Modal {
	plugin: LemonsSearchPlugin;
	searchUI: SearchUI | undefined;

	constructor(plugin: LemonsSearchPlugin) {
		super(plugin.app);

		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;

		this.modalEl.addClass('lemons-search-modal');

		this.searchUI = new SearchUI(this.plugin, contentEl, () => this.close());
	}

	onClose(): void {
		const { contentEl } = this;

		this.searchUI?.destroy();

		contentEl.empty();
	}
}
