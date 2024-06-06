use std::{cell::RefCell, rc::Rc};

use leptos::{component, create_memo, create_resource, create_signal, event_target_value, view, IntoView, ReadSignal, SignalWith, WriteSignal};
use wasm_bindgen::JsValue;
use web_sys::js_sys;

use crate::{plugin_wrapper::PluginWrapper, Search};

#[component]
pub fn App(search: RefCell<Search>, plugin: Rc<PluginWrapper>, close_fn: js_sys::Function) -> impl IntoView {
    let (search_string, set_search_string) = create_signal("".to_string());
    let (selection, set_selection) = create_signal::<i32>(0);

    let results = create_memo(move |_| search.borrow_mut().search(&search_string()));

    let results_len = move || results.with(|x| x.len() as i32);

    let result_elements = move || {
        results().iter().enumerate().map(|(i, result)| {
            view! {
                <SuggestionItem str=result.0.clone() highlights=result.1.clone() index=i as i32 max_index=results_len selection=selection set_selection=set_selection />
            }
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

    let preview_plugin = plugin.clone();
    let async_preview = create_resource(selected_element, move |selected| {
        let value = preview_plugin.clone();

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

    let input_plugin = plugin.clone();
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
            if let Some(selected_element) = selected_element() {
                input_plugin.open_file(selected_element);
                close_fn.call0(&JsValue::NULL).unwrap();
            }
        }
        "Escape" => {
            close_fn.call0(&JsValue::NULL).unwrap();
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
fn SuggestionItem(str: String, highlights: Vec<u32>, index: i32, max_index: impl Fn() -> i32 + 'static, selection: ReadSignal<i32>, set_selection: WriteSignal<i32>) -> impl IntoView {
    let normalized_selection = move || selection().rem_euclid(max_index());
    let is_selected = move || index == normalized_selection();
    let set_section_to_index = move |_| set_selection(index);
    
    view! {
        <div 
            class="suggestion-item mod-complex" 
            class:is-selected=is_selected
            on:mouseenter=set_section_to_index
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
