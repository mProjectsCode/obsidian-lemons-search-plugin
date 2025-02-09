import type { Command, Hotkey, KeymapInfo } from 'obsidian';
import { parseFrontMatterAliases, Plugin, TFile } from 'obsidian';
import type { BookmarkItem } from 'obsidian-typings';
import { PromptModal } from 'packages/obsidian/src/PromptModal';
import { SearchModal } from 'packages/obsidian/src/SearchModal';
import { BasicSearchUIAdapter } from 'packages/obsidian/src/searchUI/basic/BasicSearchUIAdapter';
import { PreviewSearchUIAdapter } from 'packages/obsidian/src/searchUI/preview/PreviewSearchUIAdapter';
import type { SearchData, SearchDatum, SearchPlaceholderData } from 'packages/obsidian/src/searchUI/SearchController';
import { SearchController } from 'packages/obsidian/src/searchUI/SearchController';
import type { LemonsSearchSettings } from 'packages/obsidian/src/settings/Settings';
import { DEFAULT_SETTINGS } from 'packages/obsidian/src/settings/Settings';
import { LemonsSearchSettingsTab } from 'packages/obsidian/src/settings/SettingTab';
import { mapHotkey } from 'packages/obsidian/src/utils';
import { SearchMemo } from 'packages/obsidian/src/utils/SearchMemo';

// const DEBUG = true;

const CONTENT_SLICE_LENGTH = 5000;

export interface FileSearchPlaceholders {
	recentFiles: boolean;
	bookmarks: boolean;
}

export default class LemonsSearchPlugin extends Plugin {
	// @ts-ignore defined in on load
	settings: LemonsSearchSettings;

	// @ts-ignore defined in on load
	fileMemo: SearchMemo<string>;
	// @ts-ignore defined in on load;
	commandMemo: SearchMemo<string>;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.fileMemo = new SearchMemo<string>();
		this.commandMemo = new SearchMemo<string>();

		this.addCommand({
			id: 'open-search',
			name: 'Open search',
			callback: () => {
				const rawData = this.getRawFileSearchData();
				const data = this.getFileSearchData(rawData);
				const searchController = new SearchController(this, new PreviewSearchUIAdapter('Find a note...'), data);
				searchController.onSubmit((data, modifiers) => {
					this.fileMemo.add(data.data);
					this.openFile(data.data, modifiers.includes('Mod'));
				});

				new SearchModal(this, searchController).open();
			},
		});

		this.addCommand({
			id: 'open-alias-search',
			name: 'Open alias search',
			callback: () => {
				const rawData = this.getRawFileAliasSearchData();
				const data = this.getFileSearchData(rawData);
				const searchController = new SearchController(this, new PreviewSearchUIAdapter('Find a note...'), data);
				searchController.onSubmit((data, modifiers) => {
					this.fileMemo.add(data.data);
					this.openFile(data.data, modifiers.includes('Mod'));
				});

				new SearchModal(this, searchController).open();
			},
		});

		this.addCommand({
			id: 'open-command-palette',
			name: 'Open command palette',
			callback: () => {
				const rawData = this.getCommandData();
				const data = {
					data: rawData,
					placeholders: [this.getRecentCommandsSearchPlaceholderData(rawData)],
				};
				const searchController = new SearchController(this, new BasicSearchUIAdapter<Command>('Select a command...'), data);
				searchController.onSubmit(data => {
					this.commandMemo.add(data.data.id);
					this.app.commands.executeCommand(data.data);
				});

				new PromptModal(this, searchController).open();
			},
		});

		this.addSettingTab(new LemonsSearchSettingsTab(this.app, this));
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as LemonsSearchSettings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	getFiles(): TFile[] {
		return this.app.vault.getAllLoadedFiles().filter(file => file instanceof TFile);
	}

	getRawFileSearchData(): SearchDatum<string>[] {
		return this.getFiles().map(file => ({ content: file.path, data: file.path }));
	}

	getRawFileAliasSearchData(): SearchDatum<string>[] {
		return this.getFiles().flatMap(file => {
			const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter;
			const aliases = [file.basename, ...(parseFrontMatterAliases(metadata) ?? [])];
			return aliases.map(alias => {
				return {
					content: alias,
					subText: file.path,
					data: file.path,
				};
			});
		});
	}

	getBookmarkSearchPlaceholderData(data: SearchDatum<string>[]): SearchPlaceholderData<string> | undefined {
		const bookmarksPlugin = this.app.internalPlugins.plugins.bookmarks;
		if (!bookmarksPlugin) {
			return undefined;
		}

		const bookmarks = bookmarksPlugin.instance.getBookmarks();
		const matchingBookmarks = [];

		for (const bookmark of bookmarks) {
			if (bookmark.type !== 'file') {
				continue;
			}

			const path = (bookmark as BookmarkItem & { path: string }).path;
			const datum = data.find(d => d.data === path);
			if (datum) {
				matchingBookmarks.push(datum);
			}
		}

		return {
			title: 'Bookmarks',
			data: matchingBookmarks,
		};
	}

	getRecentFilesSearchPlaceholderData(data: SearchDatum<string>[]): SearchPlaceholderData<string> {
		return {
			title: 'Recently opened',
			data: this.fileMemo.getMatching(data, (memo, data) => memo === data.data),
		};
	}

	getFileSearchData(rawData: SearchDatum<string>[]): SearchData<string> {
		return {
			data: rawData,
			placeholders: [this.getRecentFilesSearchPlaceholderData(rawData), this.getBookmarkSearchPlaceholderData(rawData)].filter(x => x !== undefined),
		};
	}

	getCommandData(): SearchDatum<Command>[] {
		return this.app.commands.listCommands().map(command => {
			const commandManagerKeys = this.app.hotkeyManager.getHotkeys(command.id) as (KeymapInfo | Hotkey)[] | undefined;
			const keys = commandManagerKeys?.map(hotkey => mapHotkey(hotkey)) ?? command.hotkeys?.map(hotkey => mapHotkey(hotkey));

			return {
				content: command.name,
				hotKeys: keys,
				subText: command.id,
				data: command,
			};
		});
	}

	getRecentCommandsSearchPlaceholderData(data: SearchDatum<Command>[]): SearchPlaceholderData<Command> {
		return {
			title: 'Recently used',
			data: this.commandMemo.getMatching(data, (memo, data) => memo === data.data.id),
		};
	}

	async readFile(path: string): Promise<string | undefined> {
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			return undefined;
		}

		return this.app.vault.cachedRead(file);
	}

	async readFileTruncated(path: string): Promise<string | undefined> {
		const content = await this.readFile(path);
		if (content === undefined) {
			return undefined;
		}
		if (content.trim() === '') {
			return '';
		}
		if (content.length < CONTENT_SLICE_LENGTH) {
			return content;
		}
		return content.slice(0, CONTENT_SLICE_LENGTH) + '\n\n...';
	}

	openFile(path: string, newTab: boolean = true): void {
		void this.app.workspace.openLinkText(path, '', newTab);
	}

	getResourcePath(path: string): string | undefined {
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			return undefined;
		}

		return this.app.vault.getResourcePath(file);
	}
}
