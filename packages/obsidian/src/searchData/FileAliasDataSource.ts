import type { TFile } from 'obsidian';
import { parseFrontMatterAliases } from 'obsidian';
import { AbstractDataSource } from 'packages/obsidian/src/searchData/AbstractDataSource';
import { FileDataPlaceholders, getBookmarkPlaceholder } from 'packages/obsidian/src/searchData/FileDataSource';
import type { SearchDatum, SearchPlaceholderCategory } from 'packages/obsidian/src/searchUI/SearchController';

export class FileAliasDataSource extends AbstractDataSource<TFile, string, FileDataPlaceholders> {
	getId(data: SearchDatum<TFile>): string {
		return data.data.path;
	}

	getRawData(): SearchDatum<TFile>[] {
		return this.plugin.getFiles().flatMap(file => {
			const metadata = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
			const aliases = [file.basename, ...(parseFrontMatterAliases(metadata) ?? [])];
			return aliases.map(alias => {
				return {
					content: alias,
					subText: file.path,
					data: file,
				};
			});
		});
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
