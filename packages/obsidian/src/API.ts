import type { Command, Modifier, TFile } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { PromptModal } from 'packages/obsidian/src/modals/PromptModal';
import { SearchModal } from 'packages/obsidian/src/modals/SearchModal';
import type { AbstractDataSource } from 'packages/obsidian/src/searchData/AbstractDataSource';
import type { CommandDataPlaceholders } from 'packages/obsidian/src/searchData/CommandDataSource';
import type { FileDataPlaceholders } from 'packages/obsidian/src/searchData/FileDataSource';
import { BasicSearchUIAdapter } from 'packages/obsidian/src/searchUI/basic/BasicSearchUIAdapter';
import { PreviewSearchUIAdapter } from 'packages/obsidian/src/searchUI/preview/PreviewSearchUIAdapter';
import type { SearchData, SearchDatum } from 'packages/obsidian/src/searchUI/SearchController';
import { SearchController } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchUI } from 'packages/obsidian/src/searchUI/SearchUI';
import { expectType } from 'packages/obsidian/src/utils/utils';

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
export type FileSearchOptions = GenericSearchOptions<TFile> & {
	ui: SearchUIType;
	type: FileSearchType;
	/**
	 * Placeholder data to show in the search UI when no search query is entered.
	 */
	placeholders?: FileDataPlaceholders[];
};

/**
 * Options for searching for commands.
 */
export type CommandSearchOptions = GenericSearchOptions<Command> & {
	/**
	 * Placeholder data to show in the search UI when no search query is entered.
	 */
	placeholders?: CommandDataPlaceholders[];
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

	public search<T>(data: SearchData<T>, options: GenericSearchOptions<T>): void {
		const searchUI = new BasicSearchUIAdapter<T>(options.prompt ?? 'Search...');
		const searchController = new SearchController<T>(this.plugin, searchUI, data);
		searchController.onSubmit((data, modifiers) => {
			options.onSubmit(data, modifiers);
		});

		this.openModal(SearchUIType.Basic, searchController);
	}

	/**
	 * Search for files in the vault.
	 *
	 * @param options See {@link FileSearchOptions}.
	 */
	public async searchFiles(options: FileSearchOptions): Promise<void> {
		const dataSource = this.getFileDataSource(options);
		const data = await dataSource.getData(options.placeholders);

		const searchUI = this.getUIAdapterForFileSearch(options.ui, options.prompt ?? 'Select a file...');
		const searchController = new SearchController<TFile>(this.plugin, searchUI, data);
		searchController.onSubmit((data, modifiers) => {
			dataSource.onSelect(data);
			options.onSubmit(data, modifiers);
		});

		this.openModal(options.ui, searchController);
	}

	/**
	 * Search for commands.
	 *
	 * @param options See {@link CommandSearchOptions}.
	 */
	public async searchCommands(options: CommandSearchOptions): Promise<void> {
		const dataSource = this.plugin.data.command;
		const data = await dataSource.getData(options.placeholders);

		const searchUI = new BasicSearchUIAdapter<Command>(options.prompt ?? 'Select a command...');
		const searchController = new SearchController<Command>(this.plugin, searchUI, data);
		searchController.onSubmit((data, modifiers) => {
			dataSource.onSelect(data);
			options.onSubmit(data, modifiers);
		});

		this.openModal(SearchUIType.Basic, searchController);
	}

	private getFileDataSource(options: FileSearchOptions): AbstractDataSource<TFile, string, FileDataPlaceholders> {
		if (options.type === FileSearchType.FilePath) {
			return this.plugin.data.file;
		} else if (options.type === FileSearchType.Alias) {
			return this.plugin.data.alias;
		}

		expectType<never>(options.type);

		throw new Error('Invalid file search type');
	}

	private openModal<T>(uiType: SearchUIType, controller: SearchController<T>): void {
		if (uiType === SearchUIType.Basic) {
			new PromptModal(this.plugin, controller).open();
			return;
		} else if (uiType === SearchUIType.Preview) {
			new SearchModal(this.plugin, controller).open();
			return;
		}

		expectType<never>(uiType);
		throw new Error('Invalid search UI type');
	}

	private getUIAdapterForFileSearch(uiType: SearchUIType, prompt: string): SearchUI<TFile> {
		if (uiType === SearchUIType.Basic) {
			return new BasicSearchUIAdapter(prompt);
		} else if (uiType === SearchUIType.Preview) {
			return new PreviewSearchUIAdapter(prompt);
		}

		expectType<never>(uiType);
		throw new Error('Invalid search UI type');
	}
}
