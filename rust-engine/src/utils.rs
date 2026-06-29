use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::fs;
use std::io;
use std::path::Path;
use crate::models::EXTENSIONS;

pub fn cache_content(dir: &Path, hash: &str, content: &[u8]) -> io::Result<()> {
    fs::create_dir_all(dir)?;
    let path = dir.join(format!("{hash}.zst"));
    if !path.exists() {
        fs::write(path, zstd::encode_all(content, 3)?)?;
    }
    Ok(())
}

pub fn encode_payload(data: &[u8]) -> (String, &'static str, bool) {
    let compressed = zstd::encode_all(data, 3).unwrap_or_default();
    if compressed.len() + 32 < data.len() {
        (BASE64.encode(compressed), "zstd-base64", true)
    } else {
        match std::str::from_utf8(data) {
            Ok(text) => (text.to_string(), "utf8", false),
            Err(_) => (BASE64.encode(data), "base64", false),
        }
    }
}

pub fn is_indexable(path: &Path) -> bool {
    path.extension()
        .map(|v| EXTENSIONS.contains(&v.to_string_lossy().to_lowercase().as_str()))
        .unwrap_or(false)
}
