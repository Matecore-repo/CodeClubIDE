use std::fs;
use std::path::Path;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use crate::models::RangeResult;
use crate::utils::{cache_content, encode_payload};

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let path = Path::new(args.get(2).ok_or("missing path")?);
    let offset: u64 = args.get(3).and_then(|v| v.parse().ok()).unwrap_or(0);
    let length: usize = args.get(4).and_then(|v| v.parse().ok()).unwrap_or(262_144);
    let known_hash = args.get(5).map(String::as_str).unwrap_or("");
    let cache_dir = Path::new(args.get(6).ok_or("missing cache dir")?);
    let allow_compression = args.get(7).map(String::as_str) != Some("plain");
    let full = fs::read(path)?;
    let hash = blake3::hash(&full).to_hex().to_string();
    cache_content(cache_dir, &hash, &full)?;
    if hash == known_hash {
        println!(
            "{}",
            serde_json::to_string(&RangeResult {
                data: String::new(),
                hash,
                size: full.len() as u64,
                offset,
                length: 0,
                encoding: "utf8",
                compressed: false,
                unchanged: true
            })?
        );
        return Ok(());
    }
    let start = (offset as usize).min(full.len());
    let end = (start + length).min(full.len());
    let slice = &full[start..end];
    let (data, encoding, compressed) = if allow_compression {
        encode_payload(slice)
    } else {
        match std::str::from_utf8(slice) {
            Ok(text) => (text.to_string(), "utf8", false),
            Err(_) => (BASE64.encode(slice), "base64", false),
        }
    };
    println!(
        "{}",
        serde_json::to_string(&RangeResult {
            data,
            hash,
            size: full.len() as u64,
            offset: start as u64,
            length: slice.len(),
            encoding,
            compressed,
            unchanged: false
        })?
    );
    Ok(())
}
