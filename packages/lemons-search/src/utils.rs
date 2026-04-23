use nucleo_matcher::{Utf32Str, Utf32String};
use web_sys::js_sys;

pub struct NumberedString {
    index: usize,
    utf32: Utf32String,
}

impl NumberedString {
    pub fn new(index: usize, string: String) -> Self {
        NumberedString {
            index,
            utf32: Utf32String::from(string),
        }
    }

    #[inline]
    pub fn index(&self) -> usize {
        self.index
    }

    #[inline]
    pub fn utf32srt(&self) -> Utf32Str<'_> {
        self.utf32.slice(..)
    }

    pub fn string(&self) -> String {
        self.utf32.to_string()
    }
}

#[derive(Debug, Clone, Copy)]
pub struct ScoredIndex(u32, usize);

impl ScoredIndex {
    pub fn new(score: u32, index: usize) -> Self {
        ScoredIndex(score, index)
    }

    #[inline]
    pub fn score(&self) -> u32 {
        self.0
    }

    #[inline]
    pub fn idx(&self) -> usize {
        self.1
    }
}

impl PartialEq for ScoredIndex {
    #[inline]
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

impl Eq for ScoredIndex {}

impl PartialOrd for ScoredIndex {
    #[inline]
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ScoredIndex {
    #[inline]
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.0.cmp(&other.0).reverse()
    }
}

fn compact_highlight_ranges(indices: &[u32]) -> Vec<u32> {
    if indices.is_empty() {
        return Vec::new();
    }

    // Worst-case is all isolated indices, which produces 2 entries per index.
    let mut ranges = Vec::with_capacity(indices.len() * 2);

    let mut start = indices[0];
    let mut prev = indices[0];

    for &idx in indices.iter().skip(1) {
        if idx == prev + 1 {
            prev = idx;
            continue;
        }

        ranges.push(start);
        ranges.push(prev + 1);
        start = idx;
        prev = idx;
    }

    ranges.push(start);
    ranges.push(prev + 1);

    ranges
}

#[derive(Debug, Clone, PartialEq)]
pub struct SearchResult {
    pub index: usize,
    pub highlight_ranges: Vec<u32>,
}

impl SearchResult {
    pub fn new(index: usize) -> Self {
        SearchResult {
            index,
            highlight_ranges: Vec::new(),
        }
    }

    pub fn new_from_highlight_ranges(index: usize, highlight_ranges: &[u32]) -> Self {
        SearchResult {
            index,
            highlight_ranges: compact_highlight_ranges(highlight_ranges),
        }
    }

    pub fn into_js_object(self) -> js_sys::Object {
        let obj = js_sys::Object::new();
        let ranges = js_sys::Uint32Array::from(self.highlight_ranges.as_slice());
        let _ = js_sys::Reflect::set(&obj, &"index".into(), &self.index.into());
        let _ = js_sys::Reflect::set(&obj, &"r".into(), &ranges.into());

        obj
    }
}

#[cfg(test)]
mod tests {
    use super::compact_highlight_ranges;
    use wasm_bindgen_test::wasm_bindgen_test;

    #[wasm_bindgen_test]
    fn compacts_empty_indices() {
        assert_eq!(compact_highlight_ranges(&[]), Vec::<u32>::new());
    }

    #[wasm_bindgen_test]
    fn compacts_single_contiguous_run() {
        assert_eq!(compact_highlight_ranges(&[3, 4, 5, 6]), vec![3, 7]);
    }

    #[wasm_bindgen_test]
    fn compacts_multiple_runs() {
        assert_eq!(
            compact_highlight_ranges(&[1, 2, 5, 6, 7, 11]),
            vec![1, 3, 5, 8, 11, 12]
        );
    }

    #[wasm_bindgen_test]
    fn preserves_isolated_indices_as_single_length_ranges() {
        assert_eq!(
            compact_highlight_ranges(&[2, 5, 9]),
            vec![2, 3, 5, 6, 9, 10]
        );
    }
}
