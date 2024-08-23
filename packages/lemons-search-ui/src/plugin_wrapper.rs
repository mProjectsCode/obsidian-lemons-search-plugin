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

    pub type SearchController;

    #[wasm_bindgen(method, js_name=hasResults)]
    pub fn has_results(this: &SearchController) -> bool;
    #[wasm_bindgen(method, js_name=getResults)]
    pub fn get_results(this: &SearchController) -> Uint8Array;
    #[wasm_bindgen(method, js_name=search)]
    pub fn search(this: &SearchController, path: String);
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
        cancel_fn: js_sys::Function,
        search: SearchController,
    ) {
        let plugin = self.plugin.clone();
        let search = Rc::new(search);
        leptos::mount_to(
            mount_point,
            move || view! { <App search=search plugin=plugin cancel_fn=cancel_fn /> },
        );
    }
}
