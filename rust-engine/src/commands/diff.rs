use std::fs::{self, File};
use std::path::Path;
use similar::TextDiff;
use crate::models::DiffResult;
use crate::utils::{cache_content, encode_payload};

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let path = Path::new(args.get(2).ok_or("missing path")?);
    let previous_hash = args.get(3).ok_or("missing previous hash")?;
    let cache_dir = Path::new(args.get(4).ok_or("missing cache dir")?);
    let current = fs::read(path)?;
    let hash = blake3::hash(&current).to_hex().to_string();
    if &hash == previous_hash {
        println!(
            "{}",
            serde_json::to_string(&DiffResult {
                data: String::new(),
                hash,
                encoding: "utf8",
                compressed: false,
                unchanged: true,
                previous_found: true
            })?
        );
        return Ok(());
    }
    let previous_path = cache_dir.join(format!("{previous_hash}.zst"));
    let previous = if previous_path.exists() {
        zstd::decode_all(File::open(previous_path)?)?
    } else {
        vec![]
    };
    let previous_found = !previous.is_empty();
    let old = String::from_utf8_lossy(&previous);
    let new = String::from_utf8_lossy(&current);
    let diff = TextDiff::from_lines(&old, &new)
        .unified_diff()
        .context_radius(3)
        .to_string();
    cache_content(cache_dir, &hash, &current)?;
    let (data, encoding, compressed) = encode_payload(diff.as_bytes());
    println!(
        "{}",
        serde_json::to_string(&DiffResult {
            data,
            hash,
            encoding,
            compressed,
            unchanged: false,
            previous_found
        })?
    );
    Ok(())
}
