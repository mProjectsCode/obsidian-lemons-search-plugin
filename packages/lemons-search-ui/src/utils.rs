use speedy::{Readable, Writable};

#[derive(Debug, Clone, PartialEq, Readable, Writable)]
pub struct SearchResult {
    pub path: String,
    pub chars: Vec<char>,
    pub highlights: Vec<HighlightRange>,
}

#[derive(Debug, Clone, PartialEq, Readable, Writable)]
pub struct HighlightRange {
    pub start: usize,
    pub end: usize,
}
