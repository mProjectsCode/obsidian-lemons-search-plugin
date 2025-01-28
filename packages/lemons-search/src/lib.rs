mod utils;

use itertools::Itertools;
use nucleo_matcher::{
    pattern::{CaseMatching, Normalization, Pattern},
    Config, Matcher, Utf32Str,
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

        let pattern = match &mut self.pattern {
            Some(pattern) => {
                pattern.reparse(search_string, CaseMatching::Ignore, Normalization::Smart);
                pattern
            }
            None => {
                self.pattern = Some(Pattern::parse(
                    search_string,
                    CaseMatching::Ignore,
                    Normalization::Smart,
                ));
                self.pattern.as_mut().unwrap()
            }
        };

        let results = pattern
            .match_list(&self.data, &mut self.matcher)
            .into_iter()
            .take(MAX_RESULTS)
            .map(|result| {
                let mut vec = Vec::<char>::new();
                let haystack = Utf32Str::new(&result.0.string, &mut vec);
                let mut indices = Vec::<u32>::new();

                _ = pattern.indices(haystack, &mut self.matcher, &mut indices);

                indices.sort_unstable();
                indices.dedup();

                SearchResult::new(result.0.string.clone(), result.0.index, indices)
            })
            .collect_vec();

        let js_results = js_sys::Array::new();
        for result in results {
            js_results.push(&result.to_js_object());
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

struct NumberedString {
    index: usize,
    string: String,
}

impl NumberedString {
    fn new(index: usize, string: String) -> Self {
        NumberedString { index, string }
    }
}

impl AsRef<str> for NumberedString {
    fn as_ref(&self) -> &str {
        &self.string
    }
}
