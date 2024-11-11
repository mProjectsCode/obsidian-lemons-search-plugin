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
    data: Vec<String>,
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
                let haystack = Utf32Str::new(result.0, &mut vec);
                let mut indices = Vec::<u32>::new();

                _ = pattern.indices(haystack, &mut self.matcher, &mut indices);

                indices.sort_unstable();
                indices.dedup();

                SearchResult::new(result.0.clone(), indices)
            })
            .collect_vec();

        let js_results = js_sys::Array::new();
        for result in results {
            js_results.push(&result.to_js_object());
        }
        js_results
    }

    pub fn add_file(&mut self, path: String) {
        self.data.push(path);
    }

    pub fn remove_file(&mut self, path: &str) {
        self.data.retain(|x| x != path);
    }

    pub fn rename_file(&mut self, old_path: &str, new_path: String) {
        self.data.retain(|x| x != old_path);
        self.data.push(new_path);
    }

    pub fn update_index(&mut self, data: Vec<String>) {
        self.data = data;
    }

    pub fn clear_index(&mut self) {
        self.data = Vec::new();
    }

    pub fn check_index_consistency(&self, data: Vec<String>) -> bool {
        self.data == data
    }
}
