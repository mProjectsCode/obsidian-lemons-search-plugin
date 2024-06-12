use std::{cell::RefCell, rc::Rc};

use leptos::{
    component, create_effect, create_local_resource, create_memo, create_node_ref, create_signal,
    event_target_value, html, view, IntoView, NodeRef, ReadSignal, SignalWith, Suspense,
    WriteSignal,
};
use leptos_use::signal_debounced;
use wasm_bindgen::JsValue;
use web_sys::js_sys;

use crate::{plugin_wrapper::PluginWrapper, Search};

const IMAGE_FORMATS: [&str; 6] = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

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
    search: RefCell<Search>,
    plugin: Rc<PluginWrapper>,
    close_fn: js_sys::Function,
) -> impl IntoView {
    let (search_string, set_search_string) = create_signal("".to_string());
    let (selection, set_selection) = create_signal::<i32>(0);

    let debounced_search_string = signal_debounced(search_string, 100.0);

    // the search results
    let results = create_memo(move |_| search.borrow_mut().search(&debounced_search_string()));

    // length of the search results
    let results_len = move || results.with(|x| x.len() as i32);

    // the selected element
    let selected_element = move || match results_len() {
        0 => None,
        _ => Some(results.with(|x| x[selection().rem_euclid(results_len()) as usize].0.clone())),
    };

    // preview of the selected element
    let preview_plugin = plugin.clone();
    let async_preview = create_local_resource(selected_element, move |selected| {
        let plugin = preview_plugin.clone();

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

    let search_input_event = move |ev: web_sys::Event| {
        set_search_string(event_target_value(&ev));
        set_selection(0);
    };

    let close_modal = move || {
        close_fn.call0(&JsValue::NULL).unwrap();
    };

    let plugin__open_selected = plugin.clone();
    let close_modal__open_selected = close_modal.clone();
    let open_selected = move || {
        if let Some(selected_element) = selected_element() {
            plugin__open_selected.open_file(selected_element);
            close_modal__open_selected();
        }
    };

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
            close_modal();
        }
        "Tab" => {
            set_search_string(selected_element().unwrap_or_default());
        }
        _ => {}
    };

    let result_elements = move || {
        results().iter().enumerate().map(|(i, result)| {
            view! {
                <SuggestionItem str=result.0.clone() highlights=result.1.clone() index=i as i32 max_index=results_len selection=selection set_selection=set_selection open_selection=open_selected.clone() />
            }
        }).collect::<Vec<_>>()
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
                <div class="prompt-results">
                    {result_elements}
                </div>
            </div>
            <div class="lemons-search-preview">
                <Suspense fallback=move || view!{ <div class="preview-empty">Loading...</div> }>
                    {move || {
                        async_preview.map(|preview| {
                            match preview {
                                PreviewType::Text(content) => view! { <div class="preview-text">{content}</div> },
                                PreviewType::EmptyText => view! { <div class="preview-empty">Empty file...</div> },
                                PreviewType::Image(path) => view! { <div class="preview-img"><img src=path /></div> },
                                PreviewType::FileNotFound => view! { <div class="preview-empty">File not found...</div> },
                                PreviewType::Unsupported => view! { <div class="preview-empty">Unsupported file...</div> },
                                PreviewType::None => view! { <div class="preview-empty">No file selected...</div> }
                            }
                        })
                    }}
                </Suspense>
            </div>
        </div>
    }
}

#[component]
fn SuggestionItem(
    str: String,
    highlights: Vec<u32>,
    index: i32,
    max_index: impl Fn() -> i32 + 'static + Clone,
    selection: ReadSignal<i32>,
    set_selection: WriteSignal<i32>,
    open_selection: impl Fn() + 'static,
) -> impl IntoView {
    let normalized_selection = move || selection().rem_euclid(max_index());
    let is_selected = create_memo(move |_| index == normalized_selection());
    let el: NodeRef<html::Div> = create_node_ref();

    let scroll__is_selected = is_selected.clone();
    create_effect(move |_| {
        if scroll__is_selected() {
            if let Some(el) = el.get_untracked() {
                let scroll_fn =
                    js_sys::Reflect::get(&el, &JsValue::from_str("scrollIntoViewIfNeeded"))
                        .unwrap();
                if scroll_fn.is_function() {
                    let scroll_fn_2: js_sys::Function = scroll_fn.try_into().unwrap();
                    scroll_fn_2.call1(&el, &JsValue::TRUE).unwrap();
                }
            }
        }
    });

    let click__is_selected = is_selected.clone();
    let click_suggestion = move |_| {
        if click__is_selected() {
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
            node_ref=el
        >
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
            let u_highlight = *highlight as usize;

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
