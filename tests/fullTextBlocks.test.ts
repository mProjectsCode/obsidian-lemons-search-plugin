import { describe, expect, test } from 'bun:test';
import type { CachedMetadata, TFile } from 'obsidian';
import { buildFullTextBlockRecords } from '../packages/obsidian/src/searchWorker/FullTextBlocks';

function file(path: string): TFile {
	return { path } as TFile;
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
});
