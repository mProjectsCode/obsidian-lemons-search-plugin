import type { App, CachedMetadata } from 'obsidian';
import { TFile } from 'obsidian';
import type { SearchDatum, SearchResultDatum } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchRecord, SearchResultHydrationInput } from 'packages/obsidian/src/searchWorker/SearchDatastore';

export interface FullTextBlockMeta {
	filePath: string;
	startOffset: number;
	endOffset: number;
	blockType?: string;
}

const FULL_TEXT_STORE_ID = 'builtin:fullText';
const FULL_TEXT_RECORD_ID_PREFIX = `${FULL_TEXT_STORE_ID}:`;
const COMPACT_FULL_TEXT_STORE_ID = 'builtin:fullTextOwner';
const COMPACT_FULL_TEXT_RECORD_ID_PREFIX = `${COMPACT_FULL_TEXT_STORE_ID}:`;

export class FullTextRecordIds {
	private pathToOwnerId = new Map<string, number>();
	private ownerIdToPath = new Map<number, string>();
	private nextOwnerId = 1;

	clear(): void {
		this.pathToOwnerId.clear();
		this.ownerIdToPath.clear();
		this.nextOwnerId = 1;
	}

	recordId(filePath: string, startOffset: number, endOffset: number): string {
		return `${this.recordPrefixForPath(filePath)}${startOffset}:${endOffset}`;
	}

	recordPrefixForPath(filePath: string): string {
		return `${COMPACT_FULL_TEXT_RECORD_ID_PREFIX}${this.ownerIdForPath(filePath)}:`;
	}

	existingRecordPrefixForPath(filePath: string): string | undefined {
		const ownerId = this.pathToOwnerId.get(filePath);
		return ownerId === undefined ? undefined : `${COMPACT_FULL_TEXT_RECORD_ID_PREFIX}${ownerId}:`;
	}

	parse(id: string): Omit<FullTextBlockMeta, 'blockType'> | undefined {
		const compact = this.parseCompactRecordId(id);
		return compact ?? parsePathRecordId(id);
	}

	private ownerIdForPath(filePath: string): number {
		const existing = this.pathToOwnerId.get(filePath);
		if (existing !== undefined) {
			return existing;
		}

		const ownerId = this.nextOwnerId;
		this.nextOwnerId += 1;
		this.pathToOwnerId.set(filePath, ownerId);
		this.ownerIdToPath.set(ownerId, filePath);
		return ownerId;
	}

	private parseCompactRecordId(id: string): Omit<FullTextBlockMeta, 'blockType'> | undefined {
		if (!id.startsWith(COMPACT_FULL_TEXT_RECORD_ID_PREFIX)) {
			return undefined;
		}

		const [ownerIdText, startText, endText, ...extra] = id.slice(COMPACT_FULL_TEXT_RECORD_ID_PREFIX.length).split(':');
		if (extra.length > 0) {
			return undefined;
		}

		const ownerId = Number(ownerIdText);
		const startOffset = Number(startText);
		const endOffset = Number(endText);
		const filePath = this.ownerIdToPath.get(ownerId);
		if (!filePath || !Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
			return undefined;
		}

		return { filePath, startOffset, endOffset };
	}
}

export function buildFullTextBlockRecords(
	file: TFile,
	text: string,
	cache?: CachedMetadata,
	includeContentInMetadata: boolean = true,
	recordIds?: FullTextRecordIds,
): SearchRecord<SearchDatum<FullTextBlockMeta>>[] {
	const sections = cache?.sections?.filter(section => section.type !== 'yaml') ?? [];
	if (sections.length === 0) {
		return [blockRecord(file, text.trim(), 0, text.length, undefined, includeContentInMetadata, recordIds)];
	}

	const records: SearchRecord<SearchDatum<FullTextBlockMeta>>[] = [];
	for (const section of sections) {
		const start = section.position.start.offset;
		const end = section.position.end.offset;
		const blockText = text.slice(start, end).trim();
		if (blockText.length === 0) {
			continue;
		}
		records.push(blockRecord(file, blockText, start, end, section.type, includeContentInMetadata, recordIds));
	}
	return records;
}

export async function hydrateFullTextDatum(
	app: App,
	result: SearchResultHydrationInput<FullTextBlockMeta>,
	matchedTerms: string[] | undefined,
	recordIds?: FullTextRecordIds,
): Promise<SearchResultDatum<FullTextBlockMeta> | undefined> {
	const datum = result.datum ?? buildDatumFromRecordId(app, result.id, recordIds);
	if (!datum) {
		return undefined;
	}

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
		highlightRanges: fullTextHighlightRanges(content, matchedTerms),
	};
}

function buildDatumFromRecordId(app: App, id: string, recordIds?: FullTextRecordIds): SearchDatum<FullTextBlockMeta> | undefined {
	const meta = recordIds?.parse(id) ?? parsePathRecordId(id);
	if (!meta) {
		return undefined;
	}

	return {
		content: '',
		subText: meta.filePath,
		data: {
			...meta,
			blockType: findBlockType(app, meta),
		},
	};
}

function parsePathRecordId(id: string): Omit<FullTextBlockMeta, 'blockType'> | undefined {
	if (!id.startsWith(FULL_TEXT_RECORD_ID_PREFIX)) {
		return undefined;
	}

	const body = id.slice(FULL_TEXT_RECORD_ID_PREFIX.length);
	const endSeparator = body.lastIndexOf(':');
	if (endSeparator === -1) {
		return undefined;
	}

	const startSeparator = body.lastIndexOf(':', endSeparator - 1);
	if (startSeparator === -1) {
		return undefined;
	}

	const filePath = body.slice(0, startSeparator);
	const startOffset = Number(body.slice(startSeparator + 1, endSeparator));
	const endOffset = Number(body.slice(endSeparator + 1));

	if (filePath.length === 0 || !Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
		return undefined;
	}

	return { filePath, startOffset, endOffset };
}

function findBlockType(app: App, meta: Omit<FullTextBlockMeta, 'blockType'>): string | undefined {
	const cache = app.metadataCache.getCache(meta.filePath);
	return cache?.sections?.find(section => section.position.start.offset === meta.startOffset && section.position.end.offset === meta.endOffset)?.type;
}

export function fullTextHighlightRanges(text: string, matchedTerms: string[] | undefined): number[] {
	if (!matchedTerms || matchedTerms.length === 0) {
		return [];
	}

	const terms = new Set(matchedTerms.map(term => term.toLowerCase()));
	const ranges: number[] = [];
	tokenizeEach(text, (term, start, end) => {
		if (terms.has(term)) {
			ranges.push(start, end);
		}
	});
	return mergeRanges(ranges);
}

function blockRecord(
	file: TFile,
	blockText: string,
	startOffset: number,
	endOffset: number,
	blockType: string | undefined,
	includeContentInMetadata: boolean,
	recordIds?: FullTextRecordIds,
): SearchRecord<SearchDatum<FullTextBlockMeta>> {
	const meta: FullTextBlockMeta = {
		filePath: file.path,
		startOffset,
		endOffset,
		blockType,
	};
	return {
		id: recordIds?.recordId(file.path, startOffset, endOffset) ?? `${FULL_TEXT_STORE_ID}:${file.path}:${startOffset}:${endOffset}`,
		text: blockText,
		meta: {
			content: includeContentInMetadata ? blockText : '',
			subText: file.path,
			data: meta,
		},
	};
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
