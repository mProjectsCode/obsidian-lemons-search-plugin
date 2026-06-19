import type { RangeLike } from 'packages/obsidian/src/searchUI/highlight';
import { highlightTextFromRanges, toSafeRanges } from 'packages/obsidian/src/searchUI/highlight';
import type { HighlightSegment } from 'packages/obsidian/src/searchUI/SearchController';

export function highlightedSnippetFromRanges(text: string, ranges: RangeLike, contextWords: number = 6): HighlightSegment[] {
	const chars = Array.from(text);
	if (chars.length === 0) {
		return [{ t: '', h: false }];
	}

	const normalizedRanges = toSafeRanges(ranges, chars.length);
	if (normalizedRanges.length === 0) {
		return truncatePlainTextByWords(chars, contextWords * 2 + 2);
	}

	const rawStart = findContextStart(chars, normalizedRanges[0], contextWords);
	const rawEnd = findContextEnd(chars, normalizedRanges[normalizedRanges.length - 1], contextWords);
	const start = trimLeadingWhitespace(chars, rawStart, rawEnd);
	const end = trimTrailingWhitespace(chars, start, rawEnd);
	const shiftedRanges = shiftRangesIntoSnippet(normalizedRanges, start, end);

	const segments = highlightTextFromRanges(chars.slice(start, end).join(''), shiftedRanges);
	if (start > 0) {
		segments.unshift({ t: '...', h: false });
	}
	if (end < chars.length) {
		segments.push({ t: '...', h: false });
	}
	return segments;
}

function shiftRangesIntoSnippet(ranges: number[], start: number, end: number): number[] {
	const shiftedRanges: number[] = [];
	for (let i = 0; i < ranges.length; i += 2) {
		const rangeStart = Math.max(start, ranges[i]);
		const rangeEnd = Math.min(end, ranges[i + 1]);
		if (rangeEnd > rangeStart) {
			shiftedRanges.push(rangeStart - start, rangeEnd - start);
		}
	}
	return shiftedRanges;
}

function truncatePlainTextByWords(chars: string[], maxWords: number): HighlightSegment[] {
	let end = chars.length;
	let words = 0;
	let inWord = false;

	for (let i = 0; i < chars.length; i += 1) {
		if (/\s/.test(chars[i])) {
			if (inWord) {
				words += 1;
				inWord = false;
				if (words >= maxWords) {
					end = i;
					break;
				}
			}
			continue;
		}

		inWord = true;
	}

	const trimmedEnd = trimTrailingWhitespace(chars, 0, end);
	const text = chars.slice(0, trimmedEnd).join('');
	return [{ t: trimmedEnd < chars.length ? `${text}...` : text, h: false }];
}

function findContextStart(chars: string[], matchStart: number, contextWords: number): number {
	let start = matchStart;
	let words = 0;
	let inWord = false;

	for (let i = matchStart - 1; i >= 0; i -= 1) {
		if (/\s/.test(chars[i])) {
			if (inWord) {
				words += 1;
				inWord = false;
				if (words >= contextWords) {
					return i + 1;
				}
			}
			start = i;
			continue;
		}

		inWord = true;
		start = i;
	}

	return start;
}

function findContextEnd(chars: string[], matchEnd: number, contextWords: number): number {
	let end = matchEnd;
	let words = 0;
	let inWord = false;

	for (let i = matchEnd; i < chars.length; i += 1) {
		if (/\s/.test(chars[i])) {
			if (inWord) {
				words += 1;
				inWord = false;
				if (words >= contextWords) {
					return i;
				}
			}
			continue;
		}

		inWord = true;
		end = i + 1;
	}

	return end;
}

function trimLeadingWhitespace(chars: string[], start: number, end: number): number {
	let nextStart = start;
	while (nextStart < end && /\s/.test(chars[nextStart])) {
		nextStart += 1;
	}
	return nextStart;
}

function trimTrailingWhitespace(chars: string[], start: number, end: number): number {
	let nextEnd = end;
	while (nextEnd > start && /\s/.test(chars[nextEnd - 1])) {
		nextEnd -= 1;
	}
	return nextEnd;
}
