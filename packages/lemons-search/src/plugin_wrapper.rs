use std::{cell::RefCell, rc::Rc};

use leptos::view;
use wasm_bindgen::prelude::*;
use web_sys::js_sys;

use crate::{ui::App, Search, SearchIndex};

#[wasm_bindgen]
extern "C" {
    pub type LemonsSearchPlugin;

    #[wasm_bindgen(method, js_name=readFile)]
    async fn read_file(this: &LemonsSearchPlugin, path: String) -> JsValue;
    #[wasm_bindgen(method, js_name=openFile)]
    fn open_file(this: &LemonsSearchPlugin, path: String);
}

pub struct PluginWrapper {
    plugin: LemonsSearchPlugin,
}

impl PluginWrapper {
    pub fn new(plugin: LemonsSearchPlugin) -> PluginWrapper {
        PluginWrapper { plugin }
    }

    pub async fn read_file(&self, path: String) -> Option<String> {
        let value = self.plugin.read_file(path).await;
        value.as_string()
    }

    pub fn open_file(&self, path: String) {
        self.plugin.open_file(path);
    }
}

#[wasm_bindgen]
pub struct RustPlugin {
    #[wasm_bindgen(skip)]
    pub index: SearchIndex,
    plugin: Rc<PluginWrapper>,
}

#[wasm_bindgen]
impl RustPlugin {
    #[wasm_bindgen(constructor)]
    pub fn new(plugin: LemonsSearchPlugin) -> RustPlugin {
        RustPlugin {
            index: SearchIndex::new(),
            plugin: Rc::new(PluginWrapper::new(plugin)),
        }
    }

    pub fn create_search_ui(&self, mount_point: web_sys::HtmlElement, close_fn: js_sys::Function) {
        let search = RefCell::from(Search::new(self.index.data.clone()));
        let plugin = self.plugin.clone();
        leptos::mount_to(
            mount_point,
            move || view! { <App search=search plugin=plugin close_fn=close_fn /> },
        );
    }

    pub fn update_index(&mut self, data: Vec<String>) {
        self.index.data = data;
    }
}