import type { Command, Modifier } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { SearchModal } from 'packages/obsidian/src/modals/SearchModal';
import type { CommandSearchPlaceholders, FileSearchPlaceholders } from 'packages/obsidian/src/SearchDataHelper';
import { BasicSearchUIAdapter } from 'packages/obsidian/src/searchUI/basic/BasicSearchUIAdapter';
import { PreviewSearchUIAdapter } from 'packages/obsidian/src/searchUI/preview/PreviewSearchUIAdapter';
import type { SearchDatum } from 'packages/obsidian/src/searchUI/SearchController';
import { SearchController } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';

export interface GenericSearchOptions<T> {
	/**
	 * The placeholder text to show in the search input when it's empty.
	 */
	prompt?: string;
	/**
	 * Callback to run when a user selects a search result.
	 *
	 * @param data The search datum that was selected.
	 * @param modifiers Any keyboard modifiers that were active when the search result was selected.
	 */
	onSubmit: (data: SearchDatum<T>, modifiers: Modifier[]) => void;
}

/**
 * Options for searching for files.
 */
export type FileSearchOptions = GenericSearchOptions<string> & {
	ui: SearchUIType;
	type: FileSearchType;
	/**
	 * Placeholder data to show in the search UI when no search query is entered.
	 */
	placeholders?: FileSearchPlaceholders;
};

/**
 * Options for searching for commands.
 */
export type CommandSearchOptions = GenericSearchOptions<Command> & {
	/**
	 * Placeholder data to show in the search UI when no search query is entered.
	 */
	placeholders?: CommandSearchPlaceholders;
};

/**
 * The type of search UI to use.
 */
export enum SearchUIType {
	/**
	 * A simple search UI with a text input and a list of results.
	 * Similar to the default Obsidian search UI.
	 */
	Basic = 'basic',
	/**
	 * A search UI with a preview of the search results.
	 */
	Preview = 'preview',
}

/**
 * The type of file search to perform.
 */
export enum FileSearchType {
	/**
	 * Search for files by their file path.
	 */
	FilePath = 'filePath',
	/**
	 * Search for files by their aliases.
	 */
	Alias = 'alias',
}

export class API {
	plugin: LemonsSearchPlugin;

	constructor(plugin: LemonsSearchPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Search for files in the vault.
	 *
	 * @param options See {@link FileSearchOptions}.
	 */
	public searchFiles(options: FileSearchOptions): void {
		let rawData;
		if (options.type === FileSearchType.FilePath) {
			rawData = this.plugin.searchData.getRawFiles();
		} else if (options.type === FileSearchType.Alias) {
			rawData = this.plugin.searchData.getRawFileAliases();
		} else {
			throw new Error('Invalid file search type');
		}

		let searchUI: SearchUI<string>;
		if (options.ui === SearchUIType.Basic) {
			searchUI = new BasicSearchUIAdapter(options.prompt ?? 'Find a note...');
		} else if (options.ui === SearchUIType.Preview) {
			searchUI = new PreviewSearchUIAdapter(options.prompt ?? 'Find a note...');
		} else {
			throw new Error('Invalid search UI type');
		}

		const data = this.plugin.searchData.getFiles(rawData, options.placeholders);
		const searchController = new SearchController<string>(this.plugin, searchUI, data);
		searchController.onSubmit((data, modifiers) => {
			if (options.placeholders?.recentFiles) {
				this.plugin.searchData.pushRecentFile(data.data);
			}
			options.onSubmit(data, modifiers);
		});

		new SearchModal(this.plugin, searchController).open();
	}

	/**
	 * Search for commands.
	 *
	 * @param options See {@link CommandSearchOptions}.
	 */
	public searchCommands(options: CommandSearchOptions): void {
		const rawData = this.plugin.searchData.getRawCommands();
		const data = this.plugin.searchData.getCommands(rawData, options.placeholders);
		const searchUI = new BasicSearchUIAdapter<Command>(options.prompt ?? 'Select a command...');
		const searchController = new SearchController<Command>(this.plugin, searchUI, data);
		searchController.onSubmit((data, modifiers) => {
			if (options.placeholders?.recentCommands) {
				this.plugin.searchData.pushRecentCommand(data.data.id);
			}
			options.onSubmit(data, modifiers);
		});

		new SearchModal(this.plugin, searchController).open();
	}
}
