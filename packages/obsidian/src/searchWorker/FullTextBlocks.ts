import type { App, CachedMetadata } from 'obsidian';
import { TFile } from 'obsidian';
import type { SearchDatum, SearchResultDatum } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchRecord } from 'packages/obsidian/src/searchWorker/SearchDatastore';

export interface FullTextBlockMeta {
	filePath: string;
	startOffset: number;
	endOffset: number;
	blockType?: string;
}

const FULL_TEXT_STORE_ID = 'builtin:fullText';

export function buildFullTextBlockRecords(
	file: TFile,
	text: string,
	cache?: CachedMetadata,
	includeContentInMetadata: boolean = true,
): SearchRecord<SearchDatum<FullTextBlockMeta>>[] {
	const sections = cache?.sections?.filter(section => section.type !== 'yaml') ?? [];
	if (sections.length === 0) {
		return [blockRecord(file, text, 0, text.length, undefined, includeContentInMetadata)];
	}

	return sections.flatMap(section => {
		const start = section.position.start.offset;
		const end = section.position.end.offset;
		const blockText = text.slice(start, end).trim();
		if (blockText.length === 0) {
			return [];
		}
		return [blockRecord(file, text, start, end, section.type, includeContentInMetadata)];
	});
}

export async function hydrateFullTextDatum(app: App, datum: SearchDatum<FullTextBlockMeta>, query: string): Promise<SearchResultDatum<FullTextBlockMeta>> {
	let content = datum.content;

	if (content.length === 0) {
		const file = app.vault.getAbstractFileByPath(datum.data.filePath);
		if (!(file instanceof TFile)) {
			return { ...datum, highlightRanges: [] };
		}

		const text = await app.vault.cachedRead(file);
		content = text.slice(datum.data.startOffset, datum.data.endOffset).trim();
	}

	return {
		...datum,
		content,
		subText: datum.subText ?? datum.data.filePath,
		highlightRanges: fullTextHighlightRanges(content, query),
	};
}

export function fullTextHighlightRanges(text: string, query: string): number[] {
	const queryTerms = new Set(tokenizeTerms(query));
	if (queryTerms.size === 0) {
		return [];
	}

	const ranges: number[] = [];
	tokenizeEach(text, (term, start, end) => {
		if (queryTerms.has(term)) {
			ranges.push(start, end);
		}
	});
	return mergeRanges(ranges);
}

function blockRecord(
	file: TFile,
	text: string,
	startOffset: number,
	endOffset: number,
	blockType: string | undefined,
	includeContentInMetadata: boolean,
): SearchRecord<SearchDatum<FullTextBlockMeta>> {
	const blockText = text.slice(startOffset, endOffset).trim();
	const meta: FullTextBlockMeta = {
		filePath: file.path,
		startOffset,
		endOffset,
		blockType,
	};
	return {
		id: `${FULL_TEXT_STORE_ID}:${file.path}:${startOffset}:${endOffset}`,
		text: blockText,
		meta: {
			content: includeContentInMetadata ? blockText : '',
			subText: file.path,
			data: meta,
		},
	};
}

function tokenizeTerms(text: string): string[] {
	const terms: string[] = [];
	tokenizeEach(text, term => terms.push(term));
	return [...new Set(terms)].sort();
}

function tokenizeEach(text: string, emit: (term: string, start: number, end: number) => void): void {
	let term = '';
	let start = 0;
	let current = 0;

	for (const ch of text) {
		if (/[\p{Letter}\p{Number}]/u.test(ch)) {
			if (term.length === 0) {
				start = current;
			}
			term += ch.toLowerCase();
		} else if (term.length > 0) {
			emit(term, start, current);
			term = '';
		}
		current += 1;
	}

	if (term.length > 0) {
		emit(term, start, current);
	}
}

function mergeRanges(ranges: number[]): number[] {
	if (ranges.length <= 2) {
		return ranges;
	}

	const pairs: [number, number][] = [];
	for (let i = 0; i < ranges.length; i += 2) {
		pairs.push([ranges[i], ranges[i + 1]]);
	}
	pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

	const merged: number[] = [pairs[0][0], pairs[0][1]];
	for (const [start, end] of pairs.slice(1)) {
		const lastEndIndex = merged.length - 1;
		if (start <= merged[lastEndIndex]) {
			merged[lastEndIndex] = Math.max(merged[lastEndIndex], end);
			continue;
		}
		merged.push(start, end);
	}
	return merged;
}
