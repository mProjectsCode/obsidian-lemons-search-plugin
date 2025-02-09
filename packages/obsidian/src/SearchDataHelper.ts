import type { Command } from 'obsidian';
import { parseFrontMatterAliases } from 'obsidian';
import type { BookmarkItem } from 'obsidian-typings';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import type { SearchData, SearchDatum, SearchPlaceholderData } from 'packages/obsidian/src/searchUI/SearchController';
import { SearchMemo } from 'packages/obsidian/src/utils/SearchMemo';

export class SearchDataHelper {
	plugin: LemonsSearchPlugin;

	fileMemo: SearchMemo<string>;
	commandMemo: SearchMemo<string>;

	constructor(plugin: LemonsSearchPlugin) {
		this.plugin = plugin;

		this.fileMemo = new SearchMemo<string>();
		this.commandMemo = new SearchMemo<string>();
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

	getPlaceholderBookmark(data: SearchDatum<string>[]): SearchPlaceholderData<string> | undefined {
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

	getPlaceholderRecentFiles(data: SearchDatum<string>[]): SearchPlaceholderData<string> {
		return {
			title: 'Recently opened',
			data: this.fileMemo.getMatching(data, (memo, data) => memo === data.data),
		};
	}

	getFiles(rawData: SearchDatum<string>[]): SearchData<string> {
		return {
			data: rawData,
			placeholders: [this.getPlaceholderRecentFiles(rawData), this.getPlaceholderBookmark(rawData)].filter(x => x !== undefined),
		};
	}

	onFileOpen(datum: SearchDatum<string>): void {
		this.fileMemo.add(datum.data);
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

	getPlaceholderRecentCommands(data: SearchDatum<Command>[]): SearchPlaceholderData<Command> {
		return {
			title: 'Recently used',
			data: this.commandMemo.getMatching(data, (memo, data) => memo === data.data.id),
		};
	}

	getCommands(rawData: SearchDatum<Command>[]): SearchData<Command> {
		return {
			data: rawData,
			placeholders: [this.getPlaceholderRecentCommands(rawData)],
		};
	}

	onCommandExecute(datum: SearchDatum<Command>): void {
		this.commandMemo.add(datum.data.id);
	}
}
