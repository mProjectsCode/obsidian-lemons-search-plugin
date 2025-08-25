import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import type { SearchData, SearchDatum, SearchPlaceholderCategory } from 'packages/obsidian/src/searchUI/SearchController';
import { SearchMemo } from 'packages/obsidian/src/utils/SearchMemo';
import type { MaybePromise } from 'packages/obsidian/src/utils/utils';

export abstract class AbstractDataSource<T, Id, Placeholders extends string> {
	memo: SearchMemo<Id>;
	plugin: LemonsSearchPlugin;

	constructor(plugin: LemonsSearchPlugin) {
		this.plugin = plugin;
		this.memo = new SearchMemo<Id>();
	}

	abstract getId(data: SearchDatum<T>): Id;

	abstract getRawData(): MaybePromise<SearchDatum<T>[]>;
	abstract getPlaceholders(rawData: SearchDatum<T>[], active: Placeholders[]): MaybePromise<SearchPlaceholderCategory<T>[]>;

	onSelect(data: SearchDatum<T>): void {
		this.memo.add(this.getId(data));
	}

	getMemoMatching(data: SearchDatum<T>[]): SearchDatum<T>[] {
		return this.memo.getMatching(data, (memo, datum) => memo === this.getId(datum));
	}

	async getData(activePlaceholders: Placeholders[] | undefined): Promise<SearchData<T>> {
		const data = await this.getRawData();
		const placeholders = await this.getPlaceholders(data, activePlaceholders ?? []);
		return {
			data,
			placeholders,
		};
	}
}
