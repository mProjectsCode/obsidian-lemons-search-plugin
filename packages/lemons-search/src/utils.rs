use itertools::Itertools;
use speedy::{Readable, Writable};

#[derive(Debug, Clone, PartialEq, Readable, Writable)]
pub struct HighlightRange {
    pub start: usize,
    pub end: usize,
}

impl HighlightRange {
    pub fn new(start: usize, end: usize) -> Self {
        Self { start, end }
    }

    pub fn from_highlights(highlights: &Vec<u32>) -> Vec<Self> {
        let mut result = Vec::new();
        let mut current: Self = Self::new(0, 0);

        for highlight in highlights {
            let highlight = *highlight as usize;

            if current.end == highlight {
                current.end += 1;
            } else {
                if current.start != current.end {
                    result.push(current);
                }
                current = Self::new(highlight, highlight + 1);
            }
        }

        if current.start != current.end {
            result.push(current);
        }

        result
    }
}

#[derive(Debug, Clone, PartialEq, Readable, Writable)]
pub struct SearchResult {
    pub path: String,
    pub chars: Vec<char>,
    pub highlights: Vec<HighlightRange>,
}

impl SearchResult {
    pub fn new(path: String, indices: Vec<u32>) -> Self {
        let highlights = HighlightRange::from_highlights(&indices);
        let chars = path.chars().collect_vec();

        SearchResult {
            path,
            chars,
            highlights,
        }
    }
}
