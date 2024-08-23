use std::rc::Rc;

use leptos::view;
use wasm_bindgen::prelude::*;
use web_sys::js_sys::{self, Uint8Array};

use crate::ui::App;

#[wasm_bindgen]
extern "C" {
    pub type LemonsSearchPlugin;

    #[wasm_bindgen(method, js_name=readFile)]
    pub async fn read_file(this: &LemonsSearchPlugin, path: String) -> JsValue;
    #[wasm_bindgen(method, js_name=openFile)]
    pub fn open_file(this: &LemonsSearchPlugin, path: String);
    #[wasm_bindgen(method, js_name=getResourcePath)]
    pub fn get_resource_path(this: &LemonsSearchPlugin, path: String) -> Option<String>;

    pub type SearchWorkerBuffer;

    #[wasm_bindgen(method, js_name=hasData)]
    pub fn has_data(this: &SearchWorkerBuffer) -> bool;
    #[wasm_bindgen(method, js_name=getData)]
    pub fn get_data(this: &SearchWorkerBuffer) -> Uint8Array;

    pub type SearchWorkerQueue;

    #[wasm_bindgen(method, js_name=push)]
    pub fn push(this: &SearchWorkerQueue, path: String);
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

    pub fn get_resource_path(&self, path: String) -> Option<String> {
        self.plugin.get_resource_path(path)
    }
}

#[wasm_bindgen]
pub struct RustPlugin {
    plugin: Rc<PluginWrapper>,
}

#[wasm_bindgen]
impl RustPlugin {
    #[wasm_bindgen(constructor)]
    pub fn new(plugin: LemonsSearchPlugin) -> RustPlugin {
        RustPlugin {
            plugin: Rc::new(PluginWrapper::new(plugin)),
        }
    }

    pub fn create_search_ui(
        &self,
        mount_point: web_sys::HtmlElement,
        close_fn: js_sys::Function,
        search: SearchWorkerBuffer,
        queue: SearchWorkerQueue,
    ) {
        let plugin = self.plugin.clone();
        let search = Rc::new(search);
        let queue = Rc::new(queue);
        leptos::mount_to(
            mount_point,
            move || view! { <App search=search queue=queue plugin=plugin close_fn=close_fn /> },
        );
    }
}
