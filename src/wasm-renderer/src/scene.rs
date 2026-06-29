use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Node {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[wasm_bindgen]
impl Node {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Node {
        Node {
            x,
            y,
            width,
            height,
        }
    }
}

pub struct Scene {
    pub nodes: Vec<Node>,
}

impl Scene {
    pub fn new() -> Self {
        Scene { nodes: Vec::new() }
    }
}
