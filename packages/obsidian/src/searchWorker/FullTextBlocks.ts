import type { CachedMetadata, TFile } from 'obsidian';
import type { SearchDatum } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchRecord } from 'packages/obsidian/src/searchWorker/SearchDatastore';

export interface FullTextBlockMeta {
	filePath: string;
	startOffset: number;
	endOffset: number;
	blockType?: string;
}

const FULL_TEXT_STORE_ID = 'builtin:fullText';

export function buildFullTextBlockRecords(file: TFile, text: string, cache?: CachedMetadata): SearchRecord<SearchDatum<FullTextBlockMeta>>[] {
	const sections = cache?.sections?.filter(section => section.type !== 'yaml') ?? [];
	if (sections.length === 0) {
		return [blockRecord(file, text, 0, text.length, undefined)];
	}

	return sections.flatMap(section => {
		const start = section.position.start.offset;
		const end = section.position.end.offset;
		const blockText = text.slice(start, end).trim();
		if (blockText.length === 0) {
			return [];
		}
		return [blockRecord(file, text, start, end, section.type)];
	});
}

function blockRecord(
	file: TFile,
	text: string,
	startOffset: number,
	endOffset: number,
	blockType: string | undefined,
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
			content: blockText,
			subText: file.path,
			data: meta,
		},
	};
}
