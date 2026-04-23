//! Test suite for the Web and headless browsers.

#![cfg(target_arch = "wasm32")]

extern crate wasm_bindgen_test;
use lemons_search::Search;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
use web_sys::js_sys;

fn decode_result(entry: &JsValue) -> (usize, Vec<u32>) {
    let index_value =
        js_sys::Reflect::get(entry, &JsValue::from_str("index")).expect("missing index field");
    let index = index_value.as_f64().expect("index should be a number") as usize;

    let ranges_value =
        js_sys::Reflect::get(entry, &JsValue::from_str("r")).expect("missing r field");
    let ranges = js_sys::Uint32Array::new(&ranges_value).to_vec();

    (index, ranges)
}

#[wasm_bindgen_test]
fn search_respects_max_results_and_returns_expected_match_set() {
    let mut search = Search::new();
    search.set_max_results(2);
    search.update_index(vec![
        "src/search/preview/index.md".to_string(),
        "src/search/preview/adapter.ts".to_string(),
        "src/search/basic/index.md".to_string(),
        "docs/other-topic.md".to_string(),
    ]);

    let results = search.search("preview");
    assert_eq!(results.length(), 2, "must cap result count to max_results");

    let mut indices: Vec<usize> = results
        .iter()
        .map(|entry| decode_result(&entry).0)
        .collect();
    indices.sort_unstable();

    // Both preview entries should survive the top-2 cutoff for this query.
    assert_eq!(indices, vec![0, 1]);
}

#[wasm_bindgen_test]
fn narrowing_query_keeps_semantically_consistent_match_set() {
    let mut search = Search::new();
    search.set_max_results(10);
    search.update_index(vec![
        "folder/foo bar.md".to_string(),
        "folder/foo baz.md".to_string(),
        "folder/far boo.md".to_string(),
        "folder/qux.md".to_string(),
    ]);

    let broad = search.search("fo");
    let narrow = search.search("foo");

    let broad_ids: std::collections::HashSet<usize> =
        broad.iter().map(|entry| decode_result(&entry).0).collect();
    let narrow_ids: std::collections::HashSet<usize> =
        narrow.iter().map(|entry| decode_result(&entry).0).collect();

    assert!(narrow_ids.iter().all(|idx| broad_ids.contains(idx)));
    assert!(narrow_ids.contains(&0));
    assert!(narrow_ids.contains(&1));
}

#[wasm_bindgen_test]
fn search_returns_compact_highlight_ranges() {
    let mut search = Search::new();
    search.set_max_results(10);
    search.update_index(vec!["folder/foo bar.md".to_string()]);

    let results = search.search("foo");
    assert_eq!(results.length(), 1);

    let (_, ranges) = decode_result(&results.get(0));
    assert_eq!(
        ranges,
        vec![7, 10],
        "contiguous hit should be encoded as one range pair"
    );
}
