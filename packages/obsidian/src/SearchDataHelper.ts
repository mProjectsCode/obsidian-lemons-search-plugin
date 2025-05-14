import type { Command } from 'obsidian';
import { parseFrontMatterAliases } from 'obsidian';
import type { BookmarkItem } from 'obsidian-typings';
import { FileSearchType } from 'packages/obsidian/src/API';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import type { SearchData, SearchDatum, SearchPlaceholderCategory } from 'packages/obsidian/src/searchUI/SearchController';
import { SearchMemo } from 'packages/obsidian/src/utils/SearchMemo';

export interface FileSearchPlaceholders {
	recentFiles: boolean;
	bookmarks: boolean;
}

export interface CommandSearchPlaceholders {
	recentCommands: boolean;
}

export class SearchDataHelper {
	plugin: LemonsSearchPlugin;

	fileMemo: SearchMemo<string>;
	commandMemo: SearchMemo<string>;

	constructor(plugin: LemonsSearchPlugin) {
		this.plugin = plugin;

		this.fileMemo = new SearchMemo<string>();
		this.commandMemo = new SearchMemo<string>();
	}

	getRawFileData(searchType: FileSearchType): SearchDatum<string>[] {
		if (searchType === FileSearchType.FilePath) {
			return this.getRawFiles();
		} else if (searchType === FileSearchType.Alias) {
			return this.getRawFileAliases();
		} else {
			throw new Error('Invalid file search type');
		}
	}

	getRawFiles(): SearchDatum<string>[] {
		return this.plugin.getFiles().map(file => ({ content: file.path, data: file.path }));
	}

	getRawFileAliases(): SearchDatum<string>[] {
		return this.plugin.getFiles().flatMap(file => {
			const metadata = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
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

	getPlaceholderBookmark(data: SearchDatum<string>[]): SearchPlaceholderCategory<string> | undefined {
		const bookmarksPlugin = this.plugin.app.internalPlugins.plugins.bookmarks;
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

	getPlaceholderRecentFiles(data: SearchDatum<string>[]): SearchPlaceholderCategory<string> {
		return {
			title: 'Recently opened',
			data: this.fileMemo.getMatching(data, (memo, data) => memo === data.data),
		};
	}

	getFiles(rawData: SearchDatum<string>[], placeholders: FileSearchPlaceholders | undefined): SearchData<string> {
		return {
			data: rawData,
			placeholders: [
				placeholders?.recentFiles ? this.getPlaceholderRecentFiles(rawData) : undefined,
				placeholders?.bookmarks ? this.getPlaceholderBookmark(rawData) : undefined,
			].filter(x => x !== undefined),
		};
	}

	pushRecentFile(filePath: string): void {
		this.fileMemo.add(filePath);
	}

	getRawCommands(): SearchDatum<Command>[] {
		return this.plugin.app.commands.listCommands().map(command => {
			const hotkeys = this.plugin.hotkeyHelper.getHotkeysForCommand(command);
			const keys = this.plugin.hotkeyHelper.stringifyHotkeys(hotkeys);

			return {
				content: command.name,
				hotKeys: keys,
				subText: command.id,
				data: command,
			};
		});
	}

	getPlaceholderRecentCommands(data: SearchDatum<Command>[]): SearchPlaceholderCategory<Command> {
		return {
			title: 'Recently used',
			data: this.commandMemo.getMatching(data, (memo, data) => memo === data.data.id),
		};
	}

	getCommands(rawData: SearchDatum<Command>[], placeholders?: CommandSearchPlaceholders): SearchData<Command> {
		return {
			data: rawData,
			placeholders: [placeholders?.recentCommands ? this.getPlaceholderRecentCommands(rawData) : undefined].filter(x => x !== undefined),
		};
	}

	pushRecentCommand(commandId: string): void {
		this.commandMemo.add(commandId);
	}
}
