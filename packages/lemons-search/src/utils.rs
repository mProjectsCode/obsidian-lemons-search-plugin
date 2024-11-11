use itertools::Itertools;
use web_sys::js_sys;

#[derive(Debug, Clone, PartialEq)]
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

#[derive(Debug, Clone, PartialEq)]
pub struct SearchResult {
    pub path: String,
    pub highlights: Vec<(String, bool)>,
}

impl SearchResult {
    pub fn new(path: String, indices: Vec<u32>) -> Self {
        let highlight_ranges = HighlightRange::from_highlights(&indices);
        let chars = path.chars().collect_vec();
        let mut highlights: Vec<(String, bool)> = Vec::new();
        let mut current = 0;

        for highlight in highlight_ranges {
            if current != highlight.start {
                highlights.push((chars[current..highlight.start].iter().collect(), false));
            }

            highlights.push((chars[highlight.start..highlight.end].iter().collect(), true));
            current = highlight.end;
        }
        highlights.push((chars[current..].iter().collect(), false));

        SearchResult { path, highlights }
    }

    pub fn to_js_object(&self) -> js_sys::Object {
        let obj = js_sys::Object::new();
        let _ = js_sys::Reflect::set(&obj, &"path".into(), &self.path.clone().into());
        let arr = js_sys::Array::new();
        for (highlight, is_highlight) in &self.highlights {
            let highlight_obj = js_sys::Object::new();
            let _ = js_sys::Reflect::set(&highlight_obj, &"text".into(), &highlight.clone().into());
            let _ = js_sys::Reflect::set(
                &highlight_obj,
                &"highlight".into(),
                &is_highlight.clone().into(),
            );
            arr.push(&highlight_obj);
        }

        let _ = js_sys::Reflect::set(&obj, &"highlights".into(), &arr.into());

        obj
    }
}
