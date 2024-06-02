mod utils;

use std::{cell::RefCell, rc::Rc};

use itertools::Itertools;
use leptos::{component, create_signal, ev::resize, event_target_value, view, IntoView, ReadSignal, SignalGet, SignalUpdate, WriteSignal};
use nucleo_matcher::{pattern::{CaseMatching, Normalization, Pattern}, Config, Matcher, Utf32Str};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    log("Hello, lemons-search!");
}

#[wasm_bindgen]
pub fn setup() {
   console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct SearchOptions {
    #[wasm_bindgen(getter_with_clone)]
    pub search_string: String,
}

#[wasm_bindgen]
impl SearchOptions {
    #[wasm_bindgen(constructor)]
    pub fn new(search_string: String) -> SearchOptions {
        SearchOptions { search_string }
    }
}

#[wasm_bindgen]
pub struct FileData {
    #[wasm_bindgen(getter_with_clone)]
    pub path: String,
    #[wasm_bindgen(getter_with_clone)]
    pub content: String,
}

#[wasm_bindgen]
impl FileData {
    #[wasm_bindgen(constructor)]
    pub fn new(path: String, content: String) -> FileData {
        FileData { path, content }
    }
}

pub struct SearchIndex {
    pub index: Vec<FileData>,
    matcher: Matcher,
    pattern: Option<Pattern>,
}

impl SearchIndex {
    pub fn new() -> SearchIndex {
        let matcher = Matcher::new(Config::DEFAULT);

        SearchIndex { index: Vec::new(), matcher, pattern: None }
    }

    pub fn search(&mut self, search_string: &str) -> Vec<(String, Vec<u32>)> {
        let file_paths = self.index.iter().map(|file| &file.path);
        // log(&format!("{:?}", file_paths));

        let pattern = match &mut self.pattern {
            Some(pattern) => {
                pattern.reparse(search_string, CaseMatching::Ignore, Normalization::Smart);
                pattern
            },
            None => {
                self.pattern = Some(Pattern::parse(search_string, CaseMatching::Ignore, Normalization::Smart));
                self.pattern.as_mut().unwrap()
            }
        };

        pattern.match_list(file_paths, &mut self.matcher).into_iter().take(100).map(|result| {
            let mut vec = Vec::<char>::new();
            let haystack = Utf32Str::new(result.0, &mut vec);
            let mut indices = Vec::<u32>::new();

            _ = pattern.indices(haystack, &mut self.matcher, &mut indices);

            indices.sort_unstable();
            indices.dedup();

            (result.0.clone(), indices)
        }).collect_vec()
    }
}

type WrappedSearchIndex = Rc<RefCell<SearchIndex>>;

#[wasm_bindgen]
pub struct Search {
    #[wasm_bindgen(skip)]
    pub index: WrappedSearchIndex,
    index_read: ReadSignal<WrappedSearchIndex>,
    index_write: WriteSignal<WrappedSearchIndex>,
}

#[wasm_bindgen]
impl Search {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Search {
        let index = Rc::from(RefCell::from(SearchIndex::new()));
        let (index_read, index_write) = create_signal(index.clone());
        Search { index, index_read, index_write }
    }

    pub fn create_search_ui(&self, mount_point: web_sys::HtmlElement) {
        let read_signal = self.index_read.clone();
        leptos::mount_to(mount_point, move || view! { <App search=read_signal /> });
    }

    pub fn add_file(&self, path: String, content: String) {
        let file = FileData::new(path, content);
        self.index_write.update(|index| {
            index.borrow_mut().index.push(file);
        });
    }
}

#[component]
fn App(search: ReadSignal<WrappedSearchIndex>) -> impl IntoView {
    let (search_string, set_search_string) = create_signal("".to_string());

    view! {
        <input type="text"
            on:input=move |ev| {

                set_search_string(event_target_value(&ev));
            }
            prop:value=search_string
        />
        {move || {
            let results = search().borrow_mut().search(&search_string());

            // log(&format!("{:?}", results));

            results.iter().take(100).map(|result| view! {
                <p>
                    {render_search_result(result.0.clone(), &result.1)}
                </p>
            }).collect::<Vec<_>>()
        }}
    }
}

fn render_search_result(str: String, highlights: &Vec<u32>) -> impl IntoView {
    if highlights.is_empty() {
        view! { <span>{str}</span> }
    } else {
        let mut result = Vec::new();
        let mut start = 0;
        for highlight in highlights {
            let u_highlight = highlight.clone() as usize;

            if start != u_highlight {
                result.push(view! { <span>{str[start..u_highlight].to_owned()}</span> });
            }

            result.push(view! { <span style="color: yellow;">{str[u_highlight..u_highlight + 1].to_owned()}</span> });
            start = u_highlight + 1;
        }
        result.push(view! { <span>{str[start..].to_owned()}</span> });

        view! { <span>{result}</span> }
    }
}