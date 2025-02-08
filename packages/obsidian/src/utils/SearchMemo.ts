import type { SearchData } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';

export const MAX_MEMO_SIZE = 10;

export class SearchMemo<T> {
	memo: T[];

	constructor() {
		this.memo = [];
	}

	get(): T[] {
		return this.memo;
	}

	getMatching<U>(list: SearchData<U>[], matches: (memo: T, data: SearchData<U>) => boolean): SearchData<U>[] {
		const matching: SearchData<U>[] = [];
		for (const memo of this.memo) {
			for (const data of list) {
				if (matches(memo, data)) {
					matching.push(data);
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
