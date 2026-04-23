import type { HighlightSegment } from 'packages/obsidian/src/searchUI/SearchController';

type RangeLike = Uint32Array | number[] | undefined;
type NormalizedRange = [start: number, end: number];

function pushSegment(segments: HighlightSegment[], chars: string[], start: number, end: number, highlighted: boolean): void {
	if (end <= start) {
		return;
	}

	segments.push({
		t: chars.slice(start, end).join(''),
		h: highlighted,
	});
}

function toSafeRanges(ranges: RangeLike, textCodepoints: number): number[] {
	if (ranges === undefined || ranges.length < 2) {
		return [];
	}

	const pairs: NormalizedRange[] = [];
	const pairCount = Math.floor(ranges.length / 2);

	for (let i = 0; i < pairCount; i += 1) {
		const rawStart = Number(ranges[i * 2]);
		const rawEnd = Number(ranges[i * 2 + 1]);
		if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
			continue;
		}

		const start = Math.max(0, Math.min(textCodepoints, Math.trunc(rawStart)));
		const end = Math.max(start, Math.min(textCodepoints, Math.trunc(rawEnd)));
		if (end <= start) {
			continue;
		}

		pairs.push([start, end]);
	}

	if (pairs.length === 0) {
		return [];
	}

	if (pairs.length === 1) {
		return [pairs[0][0], pairs[0][1]];
	}

	// Rust currently emits sorted, non-overlapping ranges, but normalize defensively
	// in case other producers provide unsorted/overlapping pairs.
	pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

	const merged: number[] = [pairs[0][0], pairs[0][1]];
	for (let i = 1; i < pairs.length; i += 1) {
		const [start, end] = pairs[i];
		const lastEndIndex = merged.length - 1;
		if (start <= merged[lastEndIndex]) {
			if (end > merged[lastEndIndex]) {
				merged[lastEndIndex] = end;
			}
			continue;
		}

		merged.push(start, end);
	}

	return merged;
}

export function highlightTextFromRanges(text: string, ranges: RangeLike): HighlightSegment[] {
	if (text.length === 0) {
		return [{ t: '', h: false }];
	}

	const chars = Array.from(text);
	const normalizedRanges = toSafeRanges(ranges, chars.length);
	if (normalizedRanges.length === 0) {
		return [{ t: text, h: false }];
	}

	const segments: HighlightSegment[] = [];
	let cursor = 0;

	for (let i = 0; i < normalizedRanges.length; i += 2) {
		const start = normalizedRanges[i];
		const end = normalizedRanges[i + 1];

		pushSegment(segments, chars, cursor, start, false);
		pushSegment(segments, chars, start, end, true);

		cursor = end;
	}

	pushSegment(segments, chars, cursor, chars.length, false);

	return segments;
}
