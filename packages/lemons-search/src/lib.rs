mod utils;

use std::{cell::RefCell, path, rc::Rc};

use itertools::Itertools;
use leptos::{
    component, create_memo, create_resource, create_signal, ev::resize, event_target_value, view,
    IntoView, ReadSignal, SignalGet, SignalUpdate, SignalWith, WriteSignal,
};
use nucleo_matcher::{
    pattern::{CaseMatching, Normalization, Pattern},
    Config, Matcher, Utf32Str,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    pub type LemonsSearchPlugin;

    #[wasm_bindgen(method, js_name=readFile)]
    async fn read_file(this: &LemonsSearchPlugin, path: String) -> JsValue;
}

struct PluginWrapper {
    plugin: LemonsSearchPlugin,
}

impl PluginWrapper {
    fn new(plugin: LemonsSearchPlugin) -> PluginWrapper {
        PluginWrapper { plugin }
    }

    async fn read_file(&self, path: String) -> Option<String> {
        let value = self.plugin.read_file(path).await;
        value.as_string()
    }
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
}

#[wasm_bindgen]
impl FileData {
    #[wasm_bindgen(constructor)]
    pub fn new(path: String) -> FileData {
        FileData { path }
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

        SearchIndex {
            index: Vec::new(),
            matcher,
            pattern: None,
        }
    }

    pub fn search(&mut self, search_string: &str) -> Vec<(String, Vec<u32>)> {
        let file_paths = self.index.iter().map(|file| &file.path);
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
            .match_list(file_paths, &mut self.matcher)
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

type WrappedSearchIndex = Rc<RefCell<SearchIndex>>;

#[wasm_bindgen]
pub struct Search {
    #[wasm_bindgen(skip)]
    pub index: WrappedSearchIndex,
    index_read: ReadSignal<WrappedSearchIndex>,
    index_write: WriteSignal<WrappedSearchIndex>,
    plugin: Rc<PluginWrapper>,
}

#[wasm_bindgen]
impl Search {
    #[wasm_bindgen(constructor)]
    pub fn new(plugin: LemonsSearchPlugin) -> Search {
        let index = Rc::from(RefCell::from(SearchIndex::new()));
        let (index_read, index_write) = create_signal(index.clone());

        Search {
            index,
            index_read,
            index_write,
            plugin: Rc::new(PluginWrapper::new(plugin)),
        }
    }

    pub fn create_search_ui(&self, mount_point: web_sys::HtmlElement) {
        let read_signal = self.index_read.clone();
        let plugin = self.plugin.clone();
        leptos::mount_to(
            mount_point,
            move || view! { <App search=read_signal plugin=plugin /> },
        );
    }

    pub fn add_file(&self, path: String) {
        let file = FileData::new(path);
        self.index_write.update(|index| {
            index.borrow_mut().index.push(file);
        });
    }
}

#[component]
fn App(search: ReadSignal<WrappedSearchIndex>, plugin: Rc<PluginWrapper>) -> impl IntoView {
    let (search_string, set_search_string) = create_signal("".to_string());
    let (selection, set_selection) = create_signal::<i32>(0);

    let results = create_memo(move |_| search().borrow_mut().search(&search_string()));

    let results_len = move || results.with(|x| x.len() as i32);

    let result_elements = move || {
        results().iter().enumerate().map(|(i, result)| view! {
            <SuggestionItem str=result.0.clone() highlights=result.1.clone() is_selected=i as i32 == selection().rem_euclid(results_len()) />
        }).collect::<Vec<_>>()
    };

    let selected_element = move || match results_len() {
        0 => None,
        _ => Some(
            results()[selection().rem_euclid(results_len()) as usize]
                .0
                .clone(),
        ),
    };

    let async_preview = create_resource(selected_element, move |selected| {
        let value = plugin.clone();

        async move {
            if let Some(path) = selected {
                value.read_file(path).await
            } else {
                None
            }
        }
    });

    let input_input_event = move |ev: web_sys::Event| {
        set_search_string(event_target_value(&ev));
        set_selection(0);
    };

    let input_key_event = move |ev: web_sys::KeyboardEvent| match ev.key().as_str() {
        "ArrowDown" => {
            set_selection(selection() + 1);
        }
        "ArrowUp" => {
            set_selection(selection() - 1);
        }
        "Home" => {
            set_selection(0);
        }
        "End" => {
            set_selection(-1);
        }
        "Enter" => {
            log(&format!(
                "Enter: {:?}",
                results()[selection().rem_euclid(results_len()) as usize]
            ));
        }
        _ => {}
    };

    view! {
        <div class="lemons-search-wrapper">
            <div class="lemons-search-search">
                <input type="text"
                    on:input=input_input_event
                    on:keydown=input_key_event
                    prop:value=search_string
                />
                <div class="prompt-results">
                    {result_elements}
                </div>
            </div>
            <div class="lemons-search-preview">
                <pre><code>{move || match async_preview().flatten() {
                    Some(preview) => preview,
                    None => "No File Selected".to_string()
                }}</code></pre>
            </div>
        </div>
    }
}

#[component]
fn SuggestionItem(str: String, highlights: Vec<u32>, is_selected: bool) -> impl IntoView {
    view! {
        <div class="suggestion-item mod-complex" class:is-selected=is_selected>
            <div class="suggestion-content">
                {suggestion_title(str, &highlights)}
            </div>
        </div>
    }
}

fn suggestion_title(str: String, highlights: &Vec<u32>) -> impl IntoView {
    if highlights.is_empty() {
        view! { <div class="suggestion-title">{str}</div> }
    } else {
        let mut result = Vec::new();
        let mut start = 0;
        for highlight in highlights {
            let u_highlight = highlight.clone() as usize;

            if start != u_highlight {
                result.push(view! { <span>{str[start..u_highlight].to_owned()}</span> });
            }

            result.push(view! { <span class="suggestion-highlight">{str[u_highlight..u_highlight + 1].to_owned()}</span> });
            start = u_highlight + 1;
        }
        result.push(view! { <span>{str[start..].to_owned()}</span> });

        view! { <div class="suggestion-title">{result}</div> }
    }
}
