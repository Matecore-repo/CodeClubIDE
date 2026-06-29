use std::fs::{self, File};
use std::io::{self, Write};
use std::path::Path;
use std::time::UNIX_EPOCH;
use crate::models::{Chunk, ScanCache, CachedFile, EXCLUDED};
use crate::utils::is_indexable;

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let root = Path::new(args.get(2).ok_or("missing workspace")?);
    let cache_path = args.get(3).map(Path::new);
    let previous: ScanCache = cache_path
        .and_then(|path| File::open(path).ok())
        .and_then(|file| serde_json::from_reader(file).ok())
        .unwrap_or_default();
    let mut next = ScanCache::default();
    let mut output = io::BufWriter::new(io::stdout().lock());
    scan_dir(root, root, &previous, &mut next, &mut output)?;
    output.flush()?;
    if let Some(path) = cache_path {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let temp = path.with_extension("tmp");
        serde_json::to_writer(File::create(&temp)?, &next)?;
        fs::rename(temp, path)?;
    }
    Ok(())
}

fn scan_dir(
    root: &Path,
    dir: &Path,
    previous: &ScanCache,
    next: &mut ScanCache,
    output: &mut impl Write,
) -> io::Result<()> {
    let entries = match fs::read_dir(dir) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if !name.starts_with('.') && !EXCLUDED.contains(&name.as_str()) {
                scan_dir(root, &path, previous, next, output)?;
            }
        } else if is_indexable(&path) {
            let relative = path
                .strip_prefix(root)
                .map(|v| v.to_string_lossy().replace('\\', "/"))
                .unwrap_or_default();
            let metadata = match fs::metadata(&path) {
                Ok(value) => value,
                Err(_) => continue,
            };
            let modified_at = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis())
                .unwrap_or(0);
            let chunks = match previous.files.get(&relative) {
                Some(cached)
                    if cached.size == metadata.len() && cached.modified_at == modified_at =>
                {
                    cached.chunks.clone()
                }
                _ => parse_file(root, &path),
            };
            next.files.insert(
                relative,
                CachedFile {
                    size: metadata.len(),
                    modified_at,
                    chunks: chunks.clone(),
                },
            );
            for chunk in chunks {
                serde_json::to_writer(&mut *output, &chunk)?;
                writeln!(output)?;
            }
        }
    }
    Ok(())
}

fn parse_file(root: &Path, path: &Path) -> Vec<Chunk> {
    let content = match fs::read_to_string(path) {
        Ok(v) if !v.trim().is_empty() => v,
        _ => return vec![],
    };
    let relative = match path.strip_prefix(root) {
        Ok(v) => v.to_string_lossy().replace('\\', "/"),
        Err(_) => return vec![],
    };
    let hash = blake3::hash(content.as_bytes()).to_hex().to_string();
    let modified_at = fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let imports = extract_imports(&content);
    let mut ranges = section_ranges(path, &content);
    if ranges.is_empty() {
        ranges = fallback_ranges(&content);
    }
    ranges
        .into_iter()
        .map(|(start, end, kind, name)| {
            let lines: Vec<&str> = content.lines().collect();
            let code = lines[start.saturating_sub(1)..end.min(lines.len())].join("\n");
            Chunk {
                id: blake3::hash(format!("{relative}:{start}").as_bytes())
                    .to_hex()
                    .to_string(),
                file_path: relative.clone(),
                start_line: start,
                end_line: end,
                code,
                kind: Some(kind),
                name,
                imports: (!imports.is_empty()).then(|| imports.clone()),
                outbound_calls: None,
                hash: hash.clone(),
                modified_at,
            }
        })
        .collect()
}

fn section_ranges(path: &Path, content: &str) -> Vec<(usize, usize, String, Option<String>)> {
    let ext = path.extension().and_then(|v| v.to_str()).unwrap_or("").to_lowercase();
    let lines: Vec<&str> = content.lines().collect();
    let mut output = Vec::new();
    if ext == "md" {
        for (idx, line) in lines.iter().enumerate() {
            if !line.starts_with('#') { continue; }
            let name = line.trim_start_matches('#').trim();
            if name.is_empty() { continue; }
            let end = find_next(&lines, idx + 1, |line| line.starts_with('#'));
            output.push((idx + 1, end + 1, "section".into(), Some(name.chars().take(40).collect())));
        }
    } else if matches!(ext.as_str(), "json" | "yaml" | "yml" | "toml") {
        for (idx, line) in lines.iter().enumerate() {
            let trimmed = line.trim_start_matches(['"', '\'']);
            let Some(split) = trimmed.find(|c| c == ':' || c == '=') else { continue; };
            let name = trimmed[..split].trim_matches(['"', '\'', ' ']);
            if name.is_empty() || name.contains(' ') { continue; }
            let end = find_next(&lines, idx + 1, |line| {
                let trimmed = line.trim_start_matches(['"', '\'']);
                trimmed.find(|c| c == ':' || c == '=').is_some_and(|pos| {
                    let key = trimmed[..pos].trim_matches(['"', '\'', ' ']);
                    !key.is_empty() && !key.contains(' ')
                })
            });
            output.push((idx + 1, end + 1, "section".into(), Some(name.into())));
        }
    }
    output
}

fn find_next(lines: &[&str], start: usize, pred: impl Fn(&str) -> bool) -> usize {
    for idx in start..lines.len() {
        if pred(lines[idx]) {
            return idx.saturating_sub(1);
        }
    }
    lines.len().saturating_sub(1)
}

fn fallback_ranges(content: &str) -> Vec<(usize, usize, String, Option<String>)> {
    let count = content.lines().count();
    let mut out = Vec::new();
    let mut start = 1;
    while start <= count {
        let end = (start + 49).min(count);
        out.push((start, end, "block".into(), None));
        if end == count {
            break;
        }
        start += 40;
    }
    out
}

fn extract_imports(content: &str) -> Vec<String> {
    content
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if !(line.starts_with("import ") || line.contains("require(")) {
                return None;
            }
            ['"', '\'', '`'].iter().find_map(|q| {
                let start = line.find(*q)?;
                let end = line[start + 1..].find(*q)?;
                Some(line[start + 1..start + 1 + end].to_string())
            })
        })
        .collect()
}
