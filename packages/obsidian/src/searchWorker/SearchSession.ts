import type { SearchResultDatum } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchDatastore } from 'packages/obsidian/src/searchWorker/SearchDatastore';
import type { SearchService } from 'packages/obsidian/src/searchWorker/SearchService';

export class SearchSession<T> {
	private service: SearchService;
	private store: SearchDatastore<T>;
	private id: string;

	constructor(service: SearchService, store: SearchDatastore<T>, id: string) {
		this.service = service;
		this.store = store;
		this.id = id;
	}

	async search(query: string): Promise<SearchResultDatum<T>[]> {
		await this.store.whenSettled();
		const results = await this.service.searchSession(this.id, query);
		const data: SearchResultDatum<T>[] = [];
		for (const result of results) {
			const datum = await this.store.getSearchResult(result.id, query, result.r, result.m);
			if (!datum) {
				continue;
			}
			data.push(datum);
		}
		return data;
	}

	async close(): Promise<void> {
		await this.service.closeSession(this.id);
	}
}
