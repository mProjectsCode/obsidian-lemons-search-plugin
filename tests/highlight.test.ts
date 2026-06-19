import { describe, expect, test } from 'bun:test';
import { highlightTextFromRanges } from '../packages/obsidian/src/searchUI/highlight';
import { highlightedSnippetFromRanges } from '../packages/obsidian/src/searchUI/highlightSnippet';

describe('highlightTextFromRanges', () => {
	test('decodes compact Uint32Array highlight ranges from wasm directly on JS side', () => {
		const text = 'folder/foo bar.md';
		const ranges = new Uint32Array([7, 10]);

		const segments = highlightTextFromRanges(text, ranges);

		expect(segments).toEqual([
			{ t: 'folder/', h: false },
			{ t: 'foo', h: true },
			{ t: ' bar.md', h: false },
		]);
	});

	test('handles unicode code points correctly for highlighting', () => {
		const text = 'ägir';
		const ranges = [0, 2];

		const segments = highlightTextFromRanges(text, ranges);

		expect(segments).toEqual([
			{ t: 'äg', h: true },
			{ t: 'ir', h: false },
		]);
	});

	test('normalizes unsorted and overlapping ranges defensively', () => {
		const text = 'abcdef';
		const ranges = [4, 6, 1, 3, 2, 5];

		const segments = highlightTextFromRanges(text, ranges);

		expect(segments).toEqual([
			{ t: 'a', h: false },
			{ t: 'bcdef', h: true },
		]);
	});

	test('ignores invalid ranges and falls back to plain text', () => {
		const text = 'apple';
		const ranges = [4, 2, Number.NaN, 3];

		const segments = highlightTextFromRanges(text, ranges);

		expect(segments).toEqual([{ t: 'apple', h: false }]);
	});
});

describe('highlightedSnippetFromRanges', () => {
	test('centers snippets around the highlighted range with word context', () => {
		const text = 'one two three four five six seven eight nine';
		const start = Array.from(text.slice(0, text.indexOf('five'))).length;
		const end = start + Array.from('five').length;

		const segments = highlightedSnippetFromRanges(text, [start, end], 2);

		expect(segments).toEqual([
			{ t: '...', h: false },
			{ t: 'three four ', h: false },
			{ t: 'five', h: true },
			{ t: ' six seven', h: false },
			{ t: '...', h: false },
		]);
	});

	test('falls back to a plain truncated snippet without ranges', () => {
		const segments = highlightedSnippetFromRanges('one two three four five', undefined, 1);

		expect(segments).toEqual([{ t: 'one two three four...', h: false }]);
	});
});
