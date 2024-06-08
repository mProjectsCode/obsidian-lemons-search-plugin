import { Modal } from 'obsidian';
import type LemonsSearchPlugin from './main';

export class SearchModal extends Modal {
	plugin: LemonsSearchPlugin;

	constructor(plugin: LemonsSearchPlugin) {
		super(plugin.app);

		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;

		this.modalEl.addClass('lemons-search-modal');

		this.plugin.rustPlugin.create_search_ui(contentEl, () => this.close());
	}

	onClose(): void {
		const { contentEl } = this;

		contentEl.empty();
	}
}
