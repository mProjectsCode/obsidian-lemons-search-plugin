mod utils;

use std::collections::BinaryHeap;

use nucleo_matcher::{
    pattern::{CaseMatching, Normalization, Pattern},
    Config, Matcher,
};
use utils::SearchResult;
use wasm_bindgen::prelude::*;
use web_sys::js_sys;

use crate::utils::{NumberedString, ScoredIndex};

const DEFAULT_MAX_RESULTS: usize = 200;
const DEBUG: bool = false;

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
    max_results: usize,
    last_query: String,
    last_match_ids: Vec<usize>,
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
            max_results: DEFAULT_MAX_RESULTS,
            last_query: String::new(),
            last_match_ids: Vec::new(),
        }
    }

    pub fn search(&mut self, search_string: &str) -> js_sys::Array {
        if let Some(pattern) = &mut self.pattern {
            pattern.reparse(search_string, CaseMatching::Smart, Normalization::Smart);
        } else {
            self.pattern = Some(Pattern::parse(
                search_string,
                CaseMatching::Smart,
                Normalization::Smart,
            ));
        }

        let can_narrow = !self.last_query.is_empty() && search_string.starts_with(&self.last_query);
        let results = self.match_data(can_narrow);

        self.last_query.clear();
        self.last_query.push_str(search_string);

        let js_results = js_sys::Array::new();
        for result in results {
            js_results.push(&result.into_js_object());
        }

        js_results
    }

    pub fn set_max_results(&mut self, max_results: usize) {
        self.max_results = max_results.max(1);
    }

    pub fn update_index(&mut self, data: Vec<String>) {
        self.data = data
            .into_iter()
            .enumerate()
            .map(|(i, s)| NumberedString::new(i, s))
            .collect();

        self.last_query.clear();
        self.last_match_ids.clear();
    }
}

impl Search {
    fn match_data(&mut self, can_narrow: bool) -> Vec<SearchResult> {
        let Some(pattern) = self.pattern.as_ref() else {
            return Vec::new();
        };

        if pattern.atoms.is_empty() {
            return self.match_all_without_highlights();
        }

        let (scored, next_match_ids) = if can_narrow && !self.last_match_ids.is_empty() {
            let candidate_indices = std::mem::take(&mut self.last_match_ids);
            self.score_subset(&candidate_indices)
        } else {
            self.score_all()
        };

        self.last_match_ids = next_match_ids;
        self.build_results_with_highlights(scored)
    }

    fn match_all_without_highlights(&mut self) -> Vec<SearchResult> {
        self.last_match_ids.clear();
        self.data
            .iter()
            .take(self.max_results)
            .map(|item| SearchResult::new(item.index()))
            .collect()
    }

    fn score_subset(
        &mut self,
        candidate_indices: &[usize],
    ) -> (BinaryHeap<ScoredIndex>, Vec<usize>) {
        let mut scored = BinaryHeap::<ScoredIndex>::with_capacity(self.max_results);
        let mut next_match_ids = Vec::<usize>::with_capacity(candidate_indices.len());

        for &data_idx in candidate_indices {
            self.score_and_collect_match(data_idx, &mut scored, &mut next_match_ids);
        }

        (scored, next_match_ids)
    }

    fn score_all(&mut self) -> (BinaryHeap<ScoredIndex>, Vec<usize>) {
        let mut scored = BinaryHeap::<ScoredIndex>::with_capacity(self.max_results);
        let mut next_match_ids = Vec::<usize>::with_capacity(self.data.len());

        for data_idx in 0..self.data.len() {
            self.score_and_collect_match(data_idx, &mut scored, &mut next_match_ids);
        }

        (scored, next_match_ids)
    }

    fn score_and_collect_match(
        &mut self,
        data_idx: usize,
        scored: &mut BinaryHeap<ScoredIndex>,
        next_match_ids: &mut Vec<usize>,
    ) {
        let Some(pattern) = self.pattern.as_ref() else {
            return;
        };

        let item = &self.data[data_idx];
        let Some(score) = pattern.score(item.utf32srt(), &mut self.matcher) else {
            return;
        };

        next_match_ids.push(data_idx);

        if scored.len() < self.max_results {
            scored.push(ScoredIndex::new(score, data_idx));
            return;
        }

        let Some(min_idx) = scored.peek() else {
            return;
        };

        if score > min_idx.score() {
            scored.pop();
            scored.push(ScoredIndex::new(score, data_idx));
        }
    }

    fn build_results_with_highlights(
        &mut self,
        scored: BinaryHeap<ScoredIndex>,
    ) -> Vec<SearchResult> {
        let Some(pattern) = self.pattern.as_ref() else {
            return Vec::new();
        };

        let mut indices = Vec::<u32>::new();

        scored
            .into_sorted_vec()
            .into_iter()
            .map(|scored_idx| {
                let item = &self.data[scored_idx.idx()];

                indices.clear();
                _ = pattern.indices(item.utf32srt(), &mut self.matcher, &mut indices);
                indices.sort_unstable();
                indices.dedup();

                if DEBUG {
                    log(&format!(
                        "Matched: '{}', score: {}",
                        item.string(),
                        scored_idx.score(),
                    ));
                }

                SearchResult::new_from_highlight_ranges(item.index(), &indices)
            })
            .collect()
    }
}
