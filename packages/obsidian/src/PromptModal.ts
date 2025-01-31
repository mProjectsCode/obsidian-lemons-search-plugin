import { Modal } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import type { SearchController } from 'packages/obsidian/src/searchUI/SearchController';

export class PromptModal<T> extends Modal {
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
		this.modalEl.remove();

		this.searchController.create(this.containerEl, this.scope);
	}

	onClose(): void {
		this.searchController.destroy();
	}
}
