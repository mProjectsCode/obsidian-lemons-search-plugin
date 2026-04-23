import { describe, expect, test } from 'bun:test';
import { highlightTextFromRanges } from '../packages/obsidian/src/searchUI/highlight';

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
