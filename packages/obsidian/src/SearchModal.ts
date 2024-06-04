import { Modal } from 'obsidian';
import LemonsSearchPlugin from './main';
import { Search } from '../../lemons-search/pkg/lemons_search';

export class SearchModal extends Modal {
	plugin: LemonsSearchPlugin;

	constructor(plugin: LemonsSearchPlugin) {
		super(plugin.app);

		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;

		this.modalEl.addClass('lemons-search-modal');

		this.plugin.search.create_search_ui(contentEl);
	}

	onClose(): void {
		const { contentEl } = this;

		contentEl.empty();
	}
}
