mod utils;

use itertools::Itertools;
use nucleo_matcher::{
    pattern::{CaseMatching, Normalization, Pattern},
    Config, Matcher, Utf32Str, Utf32String,
};
use utils::SearchResult;
use wasm_bindgen::prelude::*;
use web_sys::js_sys;

const MAX_RESULTS: usize = 50;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn setup() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct Search {
    data: Vec<NumberedString>,
    matcher: Matcher,
    pattern: Option<Pattern>,
}

impl Default for Search {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl Search {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let matcher = Matcher::new(Config::DEFAULT.match_paths());
        Search {
            data: Vec::new(),
            matcher,
            pattern: None,
        }
    }

    pub fn search(&mut self, search_string: &str) -> js_sys::Array {
        // log(&format!("{:?}", file_paths));

        if let Some(pattern) = &mut self.pattern {
            pattern.reparse(search_string, CaseMatching::Smart, Normalization::Smart);
        } else {
            self.pattern = Some(Pattern::parse(
                search_string,
                CaseMatching::Smart,
                Normalization::Smart,
            ));
        }

        let results = self.match_data();

        let js_results = js_sys::Array::new();
        for result in results {
            js_results.push(&result.into_js_object());
        }

        js_results
    }

    pub fn update_index(&mut self, data: Vec<String>) {
        self.data = data
            .into_iter()
            .enumerate()
            .map(|(i, s)| NumberedString::new(i, s))
            .collect();
    }
}

impl Search {
    fn match_data(&mut self) -> Vec<SearchResult> {
        let Some(pattern) = &self.pattern else {
            return Vec::new();
        };

        let items: Vec<_> = if pattern.atoms.is_empty() {
            self.data.iter().map(|item| (item, 0)).collect()
        } else {
            let mut items: Vec<_> = self
                .data
                .iter()
                .filter_map(|item| {
                    pattern
                        .score(item.utf32.slice(..), &mut self.matcher)
                        .map(|score| (item, score))
                })
                .collect();

            items.sort_by_key(|(_, score)| std::cmp::Reverse(*score));

            items
        };

        let mut indices = Vec::<u32>::new();

        items
            .into_iter()
            .take(MAX_RESULTS)
            .map(|(string, _)| {
                let utf32_str = string.as_utf32_str();

                indices.clear();
                _ = pattern.indices(utf32_str, &mut self.matcher, &mut indices);

                indices.sort_unstable();
                indices.dedup();

                SearchResult::new(utf32_str, string.index, &indices)
            })
            .collect_vec()
    }
}

struct NumberedString {
    index: usize,
    utf32: Utf32String,
}

impl NumberedString {
    fn new(index: usize, string: String) -> Self {
        NumberedString {
            index,
            utf32: Utf32String::from(string),
        }
    }

    fn as_utf32_str<'a>(&'a self) -> Utf32Str<'a> {
        match &self.utf32 {
            Utf32String::Ascii(bytes) => Utf32Str::Ascii(bytes.as_bytes()),
            Utf32String::Unicode(codepoints) => Utf32Str::Unicode(codepoints),
        }
    }
}
