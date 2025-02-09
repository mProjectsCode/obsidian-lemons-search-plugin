import { Modal } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import type { SearchController } from 'packages/obsidian/src/searchUI/SearchController';

export class SearchModal<T> extends Modal {
	plugin: LemonsSearchPlugin;
	searchController: SearchController<T>;

	constructor(plugin: LemonsSearchPlugin, searchController: SearchController<T>) {
		super(plugin.app);

		this.plugin = plugin;
		this.searchController = searchController;

		searchController.onSubmit(() => {
			this.close();
		});
		searchController.onCancel(() => {
			this.close();
		});
	}

	onOpen(): void {
		this.modalEl.addClass('lemons-search--modal');
		this.titleEl.remove();

		this.searchController.create(this.contentEl, this.scope);
	}

	onClose(): void {
		this.searchController.destroy();

		this.contentEl.empty();
	}
}
