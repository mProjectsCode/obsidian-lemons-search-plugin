use speedy::{Readable, Writable};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Debug, PartialEq, Readable, Writable)]
pub struct SearchResult {
    path: String,
    indices: Vec<u32>,
}

impl SearchResult {
    pub fn new(path: String, indices: Vec<u32>) -> Self {
        SearchResult { path, indices }
    }

    pub fn indices_ref(&self) -> &Vec<u32> {
        &self.indices
    }
}

#[wasm_bindgen]
impl SearchResult {
    pub fn path(&self) -> String {
        self.path.clone()
    }

    pub fn indices(&self) -> Vec<u32> {
        self.indices.clone()
    }
}
