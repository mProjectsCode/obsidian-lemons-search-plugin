import type { TFile } from 'obsidian';
import type { BookmarkItem } from 'obsidian-typings';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { AbstractDataSource } from 'packages/obsidian/src/searchData/AbstractDataSource';
import type { SearchDatum, SearchPlaceholderCategory } from 'packages/obsidian/src/searchUI/SearchController';

export enum FileDataPlaceholders {
	RecentFiles = 'recentFiles',
	Bookmarks = 'bookmarks',
}

export function getBookmarkPlaceholder(plugin: LemonsSearchPlugin, data: SearchDatum<TFile>[]): SearchPlaceholderCategory<TFile> | undefined {
	const bookmarksPlugin = plugin.app.internalPlugins.plugins.bookmarks;
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
		const datum = data.find(d => d.data.path === path);
		if (datum) {
			matchingBookmarks.push(datum);
		}
	}

	return {
		title: 'Bookmarks',
		data: matchingBookmarks,
	};
}

export class FileDataSource extends AbstractDataSource<TFile, string, FileDataPlaceholders> {
	getId(data: SearchDatum<TFile>): string {
		return data.data.path;
	}

	getRawData(): SearchDatum<TFile>[] {
		return this.plugin.getFiles().map(file => ({ content: file.path, data: file }));
	}

	getPlaceholders(rawData: SearchDatum<TFile>[], active: FileDataPlaceholders[]): SearchPlaceholderCategory<TFile>[] {
		const placeholders: SearchPlaceholderCategory<TFile>[] = [];

		if (active.includes(FileDataPlaceholders.RecentFiles)) {
			placeholders.push({
				title: 'Recently opened',
				data: this.getMemoMatching(rawData),
			});
		}

		if (active.includes(FileDataPlaceholders.Bookmarks)) {
			const bookmarkPlaceholder = getBookmarkPlaceholder(this.plugin, rawData);
			if (bookmarkPlaceholder) {
				placeholders.push(bookmarkPlaceholder);
			}
		}

		return placeholders;
	}
}
