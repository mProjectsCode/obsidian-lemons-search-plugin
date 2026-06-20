import { describe, expect, test } from 'bun:test';
import type { App, CachedMetadata } from 'obsidian';
import { TFile } from 'obsidian';
import {
	buildFullTextBlockRecords,
	FullTextRecordIds,
	fullTextHighlightRanges,
	hydrateFullTextDatum,
} from '../packages/obsidian/src/searchWorker/FullTextBlocks';

function file(path: string): TFile {
	return Object.assign(new TFile(), { path }) as TFile;
}

function section(type: string, start: number, end: number): NonNullable<CachedMetadata['sections']>[number] {
	return {
		type,
		position: {
			start: { line: 0, col: 0, offset: start },
			end: { line: 0, col: 0, offset: end },
		},
	} as NonNullable<CachedMetadata['sections']>[number];
}

describe('buildFullTextBlockRecords', () => {
	test('falls back to one whole-file block when metadata has no sections', () => {
		const records = buildFullTextBlockRecords(file('note.md'), 'Alpha beta');

		expect(records).toEqual([
			{
				id: 'builtin:fullText:note.md:0:10',
				text: 'Alpha beta',
				meta: {
					content: 'Alpha beta',
					subText: 'note.md',
					data: {
						filePath: 'note.md',
						startOffset: 0,
						endOffset: 10,
						blockType: undefined,
					},
				},
			},
		]);
	});

	test('uses non-yaml metadata sections as stable block records', () => {
		const text = '---\ntitle: A\n---\n# Heading\nBody text\n\nSecond block';
		const headingStart = text.indexOf('# Heading');
		const paragraphStart = text.indexOf('Body text');
		const records = buildFullTextBlockRecords(file('folder/note.md'), text, {
			sections: [section('yaml', 0, headingStart), section('heading', headingStart, paragraphStart), section('paragraph', paragraphStart, text.length)],
		} as CachedMetadata);

		expect(records.map(record => ({ id: record.id, text: record.text, meta: record.meta?.data }))).toEqual([
			{
				id: `builtin:fullText:folder/note.md:${headingStart}:${paragraphStart}`,
				text: '# Heading',
				meta: {
					filePath: 'folder/note.md',
					startOffset: headingStart,
					endOffset: paragraphStart,
					blockType: 'heading',
				},
			},
			{
				id: `builtin:fullText:folder/note.md:${paragraphStart}:${text.length}`,
				text: 'Body text\n\nSecond block',
				meta: {
					filePath: 'folder/note.md',
					startOffset: paragraphStart,
					endOffset: text.length,
					blockType: 'paragraph',
				},
			},
		]);
	});

	test('can omit block content from metadata while keeping index text', () => {
		const records = buildFullTextBlockRecords(file('note.md'), 'Alpha beta', undefined, false);

		expect(records[0].text).toBe('Alpha beta');
		expect(records[0].meta?.content).toBe('');
		expect(records[0].meta?.data).toEqual({
			filePath: 'note.md',
			startOffset: 0,
			endOffset: 10,
			blockType: undefined,
		});
	});

	test('can build compact owner-based record ids', () => {
		const recordIds = new FullTextRecordIds();
		const records = buildFullTextBlockRecords(file('folder/note.md'), 'Alpha beta', undefined, false, recordIds);

		expect(records[0].id).toBe('builtin:fullTextOwner:1:0:10');
		expect(recordIds.existingRecordPrefixForPath('folder/note.md')).toBe('builtin:fullTextOwner:1:');
		expect(recordIds.parse(records[0].id)).toEqual({
			filePath: 'folder/note.md',
			startOffset: 0,
			endOffset: 10,
		});
	});

	test('computes full-text highlight ranges from hydrated content', () => {
		expect(fullTextHighlightRanges('Apple pie with apple slices', 'apple pie')).toEqual([0, 5, 6, 9, 15, 20]);
	});

	test('computes unicode highlight ranges by codepoint offset', () => {
		expect(fullTextHighlightRanges('ægir apple', 'apple ægir')).toEqual([0, 4, 5, 10]);
	});

	test('hydrates full-text results from record id without stored metadata', async () => {
		const text = '# Heading\nApple pie with apple slices';
		const headingEnd = text.indexOf('Apple');
		const note = file('folder/note:with-colon.md');
		const recordIds = new FullTextRecordIds();
		const id = recordIds.recordId(note.path, headingEnd, text.length);
		const app = {
			vault: {
				getAbstractFileByPath: (path: string) => (path === note.path ? note : undefined),
				cachedRead: async () => text,
			},
			metadataCache: {
				getCache: () => ({
					sections: [section('heading', 0, headingEnd), section('paragraph', headingEnd, text.length)],
				}),
			},
		} as unknown as App;

		const result = await hydrateFullTextDatum(
			app,
			{
				id,
			},
			'apple',
			recordIds,
		);

		expect(result).toEqual({
			content: 'Apple pie with apple slices',
			subText: note.path,
			data: {
				filePath: note.path,
				startOffset: headingEnd,
				endOffset: text.length,
				blockType: 'paragraph',
			},
			highlightRanges: [0, 5, 15, 20],
		});
	});
});
