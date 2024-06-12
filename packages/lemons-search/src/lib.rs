mod plugin_wrapper;
mod ui;
mod utils;

use itertools::Itertools;

use nucleo_matcher::{
    pattern::{CaseMatching, Normalization, Pattern},
    Config, Matcher, Utf32Str,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn setup() {
    console_error_panic_hook::set_once();
}

pub struct Search {
    data: Vec<String>,
    matcher: Matcher,
    pattern: Option<Pattern>,
}

impl Search {
    pub fn new(data: Vec<String>) -> Search {
        let matcher = Matcher::new(Config::DEFAULT.match_paths());
        Search {
            data,
            matcher,
            pattern: None,
        }
    }

    pub fn search(&mut self, search_string: &str) -> Vec<(String, Vec<u32>)> {
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

        pattern
            .match_list(&self.data, &mut self.matcher)
            .into_iter()
            .take(100)
            .map(|result| {
                let mut vec = Vec::<char>::new();
                let haystack = Utf32Str::new(result.0, &mut vec);
                let mut indices = Vec::<u32>::new();

                _ = pattern.indices(haystack, &mut self.matcher, &mut indices);

                indices.sort_unstable();
                indices.dedup();

                (result.0.clone(), indices)
            })
            .collect_vec()
    }
}

pub struct SearchIndex {
    pub data: Vec<String>,
}

impl SearchIndex {
    pub fn new() -> SearchIndex {
        SearchIndex { data: Vec::new() }
    }

    fn add_file(&mut self, path: String) {
        self.data.push(path);
    }

    fn remove_file(&mut self, path: &str) {
        self.data.retain(|x| x != path);
    }

    fn rename_file(&mut self, old_path: &str, new_path: String) {
        self.data.retain(|x| x != old_path);
        self.data.push(new_path);
    }
}

impl Default for SearchIndex {
    fn default() -> Self {
        Self::new()
    }
}
