use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const EXTENSIONS: &[&str] = &[
    "ts", "tsx", "js", "jsx", "css", "md", "json", "py", "rs", "go", "html", "yaml", "yml", "toml",
    "cpp", "c", "sh", "bash",
];

pub const EXCLUDED: &[&str] = &[
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "out",
    "dist",
    "build",
    "coverage",
    ".cache",
    ".next",
    ".nuxt",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chunk {
    pub id: String,
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub code: String,
    pub kind: Option<String>,
    pub name: Option<String>,
    pub imports: Option<Vec<String>>,
    pub outbound_calls: Option<Vec<String>>,
    pub hash: String,
    pub modified_at: u128,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexMeta {
    pub chunks: Vec<Chunk>,
    pub embed_dim: usize,
}

#[derive(Serialize)]
pub struct SearchHit {
    pub chunk: Chunk,
    pub score: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RangeResult {
    pub data: String,
    pub hash: String,
    pub size: u64,
    pub offset: u64,
    pub length: usize,
    pub encoding: &'static str,
    pub compressed: bool,
    pub unchanged: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub data: String,
    pub hash: String,
    pub encoding: &'static str,
    pub compressed: bool,
    pub unchanged: bool,
    pub previous_found: bool,
}

#[derive(Default, Serialize, Deserialize)]
pub struct ScanCache {
    pub files: HashMap<String, CachedFile>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CachedFile {
    pub size: u64,
    pub modified_at: u128,
    pub chunks: Vec<Chunk>,
}
