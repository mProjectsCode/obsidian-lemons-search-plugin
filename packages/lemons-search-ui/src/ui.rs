use std::rc::Rc;

use leptos::{
    component, create_effect, create_local_resource, create_memo, create_node_ref, create_signal,
    event_target_value, html, view, IntoView, Memo, NodeRef, SignalWith, Suspense, WriteSignal,
};
use leptos_use::{use_interval_fn, watch_debounced};
use speedy::Readable;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use web_sys::{js_sys, Element};

use crate::utils::HighlightRange;
use crate::{
    plugin_wrapper::{PluginWrapper, SearchController},
    utils::SearchResult,
};

const IMAGE_FORMATS: [&str; 6] = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

enum PreviewType {
    Text(String),
    EmptyText,
    Image(String),
    FileNotFound,
    Unsupported,
    None,
}

#[component]
pub fn App(
    search: Rc<SearchController>,
    plugin: Rc<PluginWrapper>,
    cancel_fn: js_sys::Function,
) -> impl IntoView {
    let (selection, set_selection) = create_signal::<i32>(0);
    let (search_string, set_search_string) = create_signal("".to_string());
    let prompt_results_ref: NodeRef<html::Div> = create_node_ref();

    let search__effect = search.clone();
    create_effect(move |_| {
        let search_string = search_string();
        search__effect.search(search_string);
    });

    // the search results
    let (results, set_results) = create_signal::<Vec<SearchResult>>(Vec::new());

    let _ = use_interval_fn(
        move || {
            if search.has_results() {
                set_results(
                    Vec::<SearchResult>::read_from_buffer(&search.get_results().to_vec()).unwrap(),
                );
            }
        },
        50,
    );

    // length of the search results
    let results_len = move || results.with(|x| x.len() as i32);

    let selection_memo = create_memo(move |_| match results_len() {
        0 => None,
        _ => Some(selection().rem_euclid(results_len())),
    });

    // scroll the selected element into view
    create_effect(move |_| {
        if let Some(selection) = selection_memo() {
            if let Some(el) = prompt_results_ref.get_untracked() {
                let selected_child = el.children().item(selection as u32);
                if let Some(selected_child) = selected_child {
                    scroll_into_view(&selected_child);
                }
            }
        }
    });

    // the selected element
    let selected_element =
        move || selection_memo().map(|i| results.with(|x| x[i as usize].path.clone()));

    // preview of the selected element
    let preview_plugin = plugin.clone();

    // update the search string
    let search_input_event = move |ev: web_sys::Event| {
        set_search_string(event_target_value(&ev));
        set_selection(0);
    };

    // close the modal
    let cancel_search = move || {
        cancel_fn.call0(&JsValue::NULL).unwrap();
    };

    // open the selected element
    let close_modal__open_selected = cancel_search.clone();
    let open_selected = move || {
        if let Some(selected_element) = selected_element() {
            plugin.open_file(selected_element);
            close_modal__open_selected();
        }
    };

    // handle key events
    let open_selected__search_key_event = open_selected.clone();
    let search_key_event = move |ev: web_sys::KeyboardEvent| match ev.key().as_str() {
        "ArrowDown" => {
            set_selection(selection() + 1);
            ev.prevent_default();
        }
        "ArrowUp" => {
            set_selection(selection() - 1);
            ev.prevent_default();
        }
        "Home" => {
            set_selection(0);
        }
        "End" => {
            set_selection(-1);
        }
        "Enter" => {
            open_selected__search_key_event();
        }
        "Escape" => {
            cancel_search();
        }
        "Tab" => {
            set_search_string(selected_element().unwrap_or_default());
        }
        _ => {}
    };

    let result_elements = move || {
        results()
            .iter()
            .enumerate()
            .map(|(i, result)| {
                suggestion_item(
                    result.path.clone(),
                    &result.chars,
                    &result.highlights,
                    i as i32,
                    selection_memo,
                    set_selection,
                    open_selected.clone(),
                )
            })
            .collect::<Vec<_>>()
    };

    view! {
        <div class="lemons-search-wrapper">
            <div class="lemons-search-search">
                <input type="text"
                    on:input=search_input_event
                    on:keydown=search_key_event
                    prop:value=search_string
                    placeholder="Search for files..."
                />
                <div class="prompt-results" node_ref=prompt_results_ref>
                    {result_elements}
                </div>
            </div>
            <FilePreview plugin=preview_plugin selected_element=selected_element />
        </div>
    }
}

fn suggestion_item(
    path: String,
    chars: &Vec<char>,
    highlights: &Vec<HighlightRange>,
    index: i32,
    selected_index: Memo<Option<i32>>,
    set_selection: WriteSignal<i32>,
    open_selection: impl Fn() + 'static,
) -> impl IntoView {
    let is_selected = create_memo(move |_| Some(index) == selected_index());

    let click_suggestion = move |_| {
        if is_selected() {
            open_selection();
        } else {
            set_selection(index);
        }
    };

    view! {
        <div
            class="suggestion-item mod-complex"
            class:is-selected=is_selected
            on:click=click_suggestion
        >
            <div class="suggestion-content">
                {suggestion_title(path, chars, highlights)}
            </div>
        </div>
    }
}

fn suggestion_title(
    path: String,
    chars: &Vec<char>,
    highlights: &Vec<HighlightRange>,
) -> impl IntoView {
    if highlights.is_empty() {
        view! { <div class="suggestion-title">{path}</div> }
    } else {
        let mut result = Vec::new();
        let mut current = 0;

        // log(format!("highlights: {:?}", highlights).as_str());

        for highlight in highlights {
            if current != highlight.start {
                result.push(view! { <span>{chars[current..highlight.start].to_owned()}</span> });
            }

            result.push(view! { <span class="suggestion-highlight">{chars[highlight.start..highlight.end].to_owned()}</span> });
            current = highlight.end;
        }
        result.push(view! { <span>{chars[current..].to_owned()}</span> });

        view! { <div class="suggestion-title">{result}</div> }
    }
}

#[component]
fn FilePreview(
    plugin: Rc<PluginWrapper>,
    selected_element: impl Fn() -> Option<String> + Clone + 'static,
) -> impl IntoView {
    let (selected_element_debounced, set_selected_element_debounced) =
        create_signal::<Option<String>>(None);
    let _ = watch_debounced(
        selected_element.clone(),
        move |_, _, _| {
            set_selected_element_debounced(selected_element());
        },
        50.0,
    );

    let async_preview = create_local_resource(selected_element_debounced, move |selected| {
        let plugin = plugin.clone();

        async move {
            if let Some(path) = selected {
                if path.ends_with(".md") {
                    let content = plugin.read_file(path).await;
                    match content {
                        Some(content) => match content.is_empty() {
                            true => PreviewType::EmptyText,
                            false => PreviewType::Text(content),
                        },
                        None => PreviewType::FileNotFound,
                    }
                } else if IMAGE_FORMATS.iter().any(|&format| path.ends_with(format)) {
                    let content = plugin.get_resource_path(path);
                    match content {
                        Some(content) => PreviewType::Image(content),
                        None => PreviewType::FileNotFound,
                    }
                } else {
                    PreviewType::Unsupported
                }
            } else {
                PreviewType::None
            }
        }
    });

    view! {
        <div class="lemons-search-preview">
            <Suspense fallback=move || view!{ <div class="preview-empty">Loading...</div> }>
                {move || async_preview.map(|preview| {
                    match preview {
                        PreviewType::Text(content) => view! { <div class="preview-text">{content}</div> },
                        PreviewType::EmptyText => view! { <div class="preview-empty">Empty file...</div> },
                        PreviewType::Image(path) => view! { <div class="preview-img"><img src=path /></div> },
                        PreviewType::FileNotFound => view! { <div class="preview-empty">File not found...</div> },
                        PreviewType::Unsupported => view! { <div class="preview-empty">Unsupported file...</div> },
                        PreviewType::None => view! { <div class="preview-empty">No file selected...</div> }
                    }
                })}
            </Suspense>
        </div>
    }
}

fn scroll_into_view(el: &Element) {
    let scroll_fn = js_sys::Reflect::get(el, &JsValue::from_str("scrollIntoViewIfNeeded")).unwrap();
    if scroll_fn.is_function() {
        let scroll_fn_2: js_sys::Function = scroll_fn.into();
        scroll_fn_2.call1(el, &JsValue::TRUE).unwrap();
    }
}
