import type { SearchDatum } from 'packages/obsidian/src/searchUI/SearchController';

export const MAX_MEMO_SIZE = 10;

export class SearchMemo<T> {
	memo: T[];

	constructor() {
		this.memo = [];
	}

	get(): T[] {
		return this.memo;
	}

	getMatching<U>(data: SearchDatum<U>[], matches: (memo: T, datum: SearchDatum<U>) => boolean): SearchDatum<U>[] {
		const matching: SearchDatum<U>[] = [];
		for (const memo of this.memo) {
			for (const datum of data) {
				if (matches(memo, datum)) {
					matching.push(datum);
					break;
				}
			}
		}
		return matching;
	}

	add(item: T): void {
		this.memo = this.memo.filter(memo => memo !== item);
		this.memo.unshift(item);
		if (this.memo.length > MAX_MEMO_SIZE) {
			this.memo.pop();
		}
	}

	clear(): void {
		this.memo = [];
	}
}
