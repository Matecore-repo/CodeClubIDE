use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

use crate::commands::codeclub_nodes::{decompose_file_to_sections, StructuralNode};

#[derive(Serialize, Deserialize, Clone)]
pub struct TopographicNode {
    pub id: String,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub path: String,
    pub language: String,
    #[serde(rename = "startLine")]
    pub start_line: usize,
    #[serde(rename = "endLine")]
    pub end_line: usize,
    pub bytes: usize,
    pub characters: usize,
    pub hash: String,
    #[serde(rename = "childCount")]
    pub child_count: usize,
    #[serde(rename = "isCode")]
    pub is_code: bool,
}

#[derive(Serialize)]
pub struct TopographicDiffResult {
    pub id: String,
    pub name: String,
    pub path: String,
    pub status: String, // "added", "modified", "moved", "removed"
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TopographicReadRequest {
    path: Option<String>,
    node_id: Option<String>,
    start_line: Option<usize>,
    end_line: Option<usize>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TopographicMutation {
    action: String,
    path: String,
    node_id: Option<String>,
    node_name: Option<String>,
    start_line: Option<usize>,
    end_line: Option<usize>,
    content: Option<String>,
    old_content: Option<String>,
    destination: Option<String>,
    destination_path: Option<String>,
    destination_line: Option<usize>,
    base_hash: Option<String>,
    target_hash: Option<String>,
    #[serde(default)]
    dry_run: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MutationSuccess {
    ok: bool,
    path: Option<String>,
    hash: Option<String>,
    start_line: Option<usize>,
    end_line: Option<usize>,
    status: Option<String>,
    will_mutate: Option<bool>,
    replaced_text: Option<String>,
    node_id: Option<String>,
    node_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MutationError {
    ok: bool,
    error: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadResult {
    content: String,
    hash: String,
    start_line: usize,
    end_line: usize,
}

#[derive(Serialize, Deserialize, Default)]
struct HistoryCache {
    // baseHash -> replaced text
    by_hash: HashMap<String, String>,
    // nodeId -> stack of baseHashes
    by_id: HashMap<String, Vec<String>>,
    // nodeName -> stack of baseHashes
    by_name: HashMap<String, Vec<String>>,
}

const IGNORED: &[&str] = &[".git", "node_modules", "dist", "out", "__pycache__", ".vscode", ".idea", ".venv", "venv"];
const CODE_EXTENSIONS: &[&str] = &["ts", "tsx", "js", "jsx", "py", "rs", "go", "c", "h", "cpp", "hpp", "java", "cs", "rb"];

fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
}

fn stable_hash(value: &str) -> String {
    let mut hash: u32 = 0x811c9dc5;
    for unit in value.encode_utf16() {
        hash ^= unit as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    format!("{hash:08x}")
}

fn directory_hash(path: &Path) -> String {
    let mut entries: Vec<String> = fs::read_dir(path)
        .map(|r| r.filter_map(Result::ok).map(|e| e.file_name().to_string_lossy().into_owned()).collect())
        .unwrap_or_default();
    entries.sort();
    stable_hash(&entries.join("\n"))
}

fn structural_node_id(path: &str, kind: &str, name: &str) -> String {
    stable_hash(&[path.to_lowercase(), kind.to_string(), name.to_string()].join("\u{001f}"))
}

fn node_id(root: &Path, path: &Path, type_str: &str) -> String {
    let rel = path.strip_prefix(root).unwrap_or(path).to_string_lossy().to_string();
    let norm = normalize_path(if rel.is_empty() { "." } else { &rel });
    let kind = if type_str == "folder" { "other" } else { "section" };
    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    structural_node_id(&norm, kind, &name)
}

fn is_code_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|s| CODE_EXTENSIONS.contains(&s.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn language(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_else(|| "text".to_string())
}

fn get_history(workspace: &Path) -> HistoryCache {
    let cache_file = workspace.join(".codeclub").join("topographic-history.json");
    if let Ok(content) = fs::read_to_string(&cache_file) {
        if let Ok(cache) = serde_json::from_str(&content) {
            return cache;
        }
    }
    HistoryCache::default()
}

fn save_history(workspace: &Path, cache: &HistoryCache) {
    let cache_dir = workspace.join(".codeclub");
    if fs::create_dir_all(&cache_dir).is_ok() {
        if let Ok(json) = serde_json::to_string(cache) {
            let _ = fs::write(cache_dir.join("topographic-history.json"), json);
        }
    }
}

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let subcmd = args.get(2).map(String::as_str).ok_or("Missing subcommand")?;
    let workspace_path = args.get(3).ok_or("Missing workspace path")?;
    let workspace = Path::new(workspace_path);

    match subcmd {
        "tree" => {
            let tree = build_tree(workspace)?;
            println!("{}", serde_json::to_string(&tree)?);
        }
        "diff" => {
            let mut stdin_content = String::new();
            io::stdin().read_to_string(&mut stdin_content)?;
            let req: (Vec<TopographicNode>, Vec<TopographicNode>) = serde_json::from_str(&stdin_content)?;
            let diffs = diff_trees(&req.0, &req.1);
            println!("{}", serde_json::to_string(&diffs)?);
        }
        "read" => {
            let mut stdin_content = String::new();
            io::stdin().read_to_string(&mut stdin_content)?;
            let req: TopographicReadRequest = serde_json::from_str(&stdin_content)?;
            match read_content(workspace, req) {
                Ok(res) => println!("{}", serde_json::to_string(&res)?),
                Err(e) => println!("{}", serde_json::to_string(&MutationError { ok: false, error: e.to_string() })?),
            }
        }
        "mutate" => {
            let mut stdin_content = String::new();
            io::stdin().read_to_string(&mut stdin_content)?;
            let req: TopographicMutation = serde_json::from_str(&stdin_content)?;
            match mutate(workspace, req) {
                Ok(res) => println!("{}", serde_json::to_string(&res)?),
                Err(e) => println!("{}", serde_json::to_string(&MutationError { ok: false, error: e.to_string() })?),
            }
        }
        _ => return Err(format!("Unknown topographic subcommand: {}", subcmd).into()),
    }
    Ok(())
}

fn build_tree(workspace: &Path) -> Result<Vec<TopographicNode>, Box<dyn std::error::Error>> {
    let mut result = Vec::new();
    let mut queue = vec![(workspace.to_path_buf(), None)];

    while let Some((path, parent_id)) = queue.pop() {
        let is_root = path == workspace;
        let md = match fs::metadata(&path) {
            Ok(md) => md,
            Err(_) => continue,
        };
        let node_type = if md.is_dir() {
            if is_root { "workspace" } else { "folder" }
        } else {
            "file"
        };
        let id = node_id(workspace, &path, node_type);

        if md.is_dir() {
            let mut child_count = 0;
            if let Ok(entries) = fs::read_dir(&path) {
                let mut valid_entries = Vec::new();
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if !IGNORED.contains(&name.as_str()) && !name.ends_with(".pyc") {
                        valid_entries.push(entry.path());
                        child_count += 1;
                    }
                }
                for entry_path in valid_entries.into_iter().rev() {
                    queue.push((entry_path, Some(id.clone())));
                }
            }
            result.push(TopographicNode {
                id,
                parent_id,
                name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                node_type: node_type.to_string(),
                path: normalize_path(&path.to_string_lossy()),
                language: "".to_string(),
                start_line: 0,
                end_line: 0,
                bytes: 0,
                characters: 0,
                hash: directory_hash(&path),
                child_count,
                is_code: false,
            });
        } else {
            let content = fs::read_to_string(&path).unwrap_or_default();
            let is_code = is_code_path(&path);
            let sections = if is_code {
                decompose_file_to_sections(&path.to_string_lossy(), &content)
            } else {
                Vec::new()
            };
            
            let line_count = content.lines().count().max(1);
            result.push(TopographicNode {
                id: id.clone(),
                parent_id,
                name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                node_type: node_type.to_string(),
                path: normalize_path(&path.to_string_lossy()),
                language: language(&path),
                start_line: 1,
                end_line: line_count,
                bytes: content.len(),
                characters: content.chars().count(),
                hash: stable_hash(&content),
                child_count: sections.len(),
                is_code,
            });

            for section in sections {
                let section_type = match section.node_type.as_str() {
                    "function"
                    | "method"
                    | "class"
                    | "interface"
                    | "struct"
                    | "enum"
                    | "trait"
                    | "impl"
                    | "type"
                    | "variable"
                    | "section"
                    | "block" => section.node_type.clone(),
                    _ => "other".to_string(),
                };
                result.push(TopographicNode {
                    id: section.id,
                    parent_id: Some(id.clone()),
                    name: section.name,
                    node_type: section_type,
                    path: normalize_path(&path.to_string_lossy()),
                    language: language(&path),
                    start_line: section.start_line,
                    end_line: section.end_line,
                    bytes: section.content.len(),
                    characters: section.content.chars().count(),
                    hash: section.base_hash,
                    child_count: 0,
                    is_code,
                });
            }
        }
    }
    Ok(result)
}

fn diff_trees(tree_a: &[TopographicNode], tree_b: &[TopographicNode]) -> Vec<TopographicDiffResult> {
    let mut diffs = Vec::new();
    let map_a: HashMap<_, _> = tree_a.iter().map(|n| (&n.id, n)).collect();
    let map_b: HashMap<_, _> = tree_b.iter().map(|n| (&n.id, n)).collect();

    for (id, b) in &map_b {
        if let Some(a) = map_a.get(id) {
            if a.hash != b.hash {
                diffs.push(TopographicDiffResult { id: (*id).clone(), name: b.name.clone(), path: b.path.clone(), status: "modified".to_string() });
            } else if a.parent_id != b.parent_id || a.path != b.path {
                diffs.push(TopographicDiffResult { id: (*id).clone(), name: b.name.clone(), path: b.path.clone(), status: "moved".to_string() });
            }
        } else {
            diffs.push(TopographicDiffResult { id: (*id).clone(), name: b.name.clone(), path: b.path.clone(), status: "added".to_string() });
        }
    }
    for (id, a) in &map_a {
        if !map_b.contains_key(id) {
            diffs.push(TopographicDiffResult { id: (*id).clone(), name: a.name.clone(), path: a.path.clone(), status: "removed".to_string() });
        }
    }
    diffs
}

fn read_content(workspace: &Path, req: TopographicReadRequest) -> Result<ReadResult, Box<dyn std::error::Error>> {
    let path_str = req.path.ok_or("path-required")?;
    let path = workspace.join(path_str);
    if path.is_dir() {
        return Err("folder-has-no-content".into());
    }
    let content = fs::read_to_string(&path)?;
    let mut start = req.start_line.unwrap_or(1);
    let mut end = req.end_line.unwrap_or_else(|| content.lines().count().max(1));
    let mut hash = stable_hash(&content);

    if let Some(node_id_req) = req.node_id {
        if node_id_req == node_id(workspace, &path, "file") {
            return Ok(ReadResult { content, hash, start_line: start, end_line: end });
        }
        let nodes = decompose_file_to_sections(&path.to_string_lossy(), &content);
        let target = nodes.into_iter().find(|n| n.id == node_id_req).ok_or("node-not-found")?;
        start = target.start_line;
        end = target.end_line;
        hash = target.base_hash;
    }

    let lines: Vec<&str> = content.split('\n').collect();
    if start < 1 || start > lines.len() || end < start || end > lines.len() {
        return Err("range-out-of-bounds".into());
    }
    let sliced = lines[start - 1..end].join("\n");
    Ok(ReadResult { content: sliced, hash, start_line: start, end_line: end })
}

fn mutate(workspace: &Path, mut req: TopographicMutation) -> Result<MutationSuccess, Box<dyn std::error::Error>> {
    let path = workspace.join(&req.path);
    let mut history = get_history(workspace);

    if req.action == "undo" {
        if !path.exists() { return Err("path-not-found".into()); }
        let target_hash = req.target_hash.clone().or_else(|| {
            if let Some(nid) = &req.node_id {
                if let Some(stack) = history.by_id.get_mut(nid) { return stack.pop(); }
            }
            if let Some(nname) = &req.node_name {
                if let Some(stack) = history.by_name.get_mut(nname) { return stack.pop(); }
            }
            None
        }).ok_or("undo-requires-targethash-or-recent-history")?;

        let cached_content = history.by_hash.get(&target_hash).ok_or(format!("undo-hash-not-found:{target_hash}"))?.clone();
        let current = fs::read_to_string(&path)?;
        let nodes = decompose_file_to_sections(&path.to_string_lossy(), &current);
        let target = resolve_node(&nodes, req.node_id.as_deref(), req.node_name.as_deref()).ok_or("node-not-found")?;
        
        let mut lines: Vec<&str> = current.split('\n').collect();
        let mut next = lines[..target.start_line - 1].join("\n");
        if !next.is_empty() { next.push('\n'); }
        next.push_str(&cached_content);
        if target.end_line < lines.len() {
            next.push('\n');
            next.push_str(&lines[target.end_line..].join("\n"));
        }
        
        if req.dry_run {
            return Ok(MutationSuccess { ok: true, path: Some(normalize_path(&path.to_string_lossy())), status: Some("dry-run-preview".into()), will_mutate: Some(false), replaced_text: Some(cached_content.clone()), start_line: Some(target.start_line), end_line: Some(target.start_line + cached_content.lines().count().max(1) - 1), node_id: None, node_name: None, hash: None });
        }
        fs::write(&path, &next)?;
        save_history(workspace, &history);
        return Ok(MutationSuccess { ok: true, path: Some(normalize_path(&path.to_string_lossy())), hash: Some(stable_hash(&next)), start_line: Some(target.start_line), end_line: Some(target.start_line + cached_content.lines().count().max(1) - 1), node_id: Some(target.id.clone()), node_name: Some(target.name.clone()), status: None, will_mutate: None, replaced_text: None });
    }

    if req.action == "create-folder" {
        fs::create_dir_all(&path)?;
        return Ok(MutationSuccess { ok: true, path: Some(normalize_path(&path.to_string_lossy())), hash: None, start_line: None, end_line: None, status: None, will_mutate: None, replaced_text: None, node_id: None, node_name: None });
    }
    if req.action == "create-file" {
        if let Some(parent) = path.parent() { fs::create_dir_all(parent)?; }
        let content = req.content.clone().unwrap_or_default();
        fs::write(&path, &content)?;
        return Ok(MutationSuccess { ok: true, path: Some(normalize_path(&path.to_string_lossy())), hash: Some(stable_hash(&content)), start_line: None, end_line: None, status: None, will_mutate: None, replaced_text: None, node_id: None, node_name: None });
    }
    if !path.exists() { return Err("path-not-found".into()); }

    if req.action == "rename" || req.action == "move" {
        let dest = req.destination.as_deref().ok_or("missing destination")?;
        let dest_path = if req.action == "rename" && !dest.contains('/') && !dest.contains('\\') {
            path.parent().unwrap_or(Path::new("")).join(dest)
        } else {
            workspace.join(dest)
        };
        if let Some(parent) = dest_path.parent() { fs::create_dir_all(parent)?; }
        fs::rename(&path, &dest_path)?;
        return Ok(MutationSuccess { ok: true, path: Some(normalize_path(&dest_path.to_string_lossy())), hash: None, start_line: None, end_line: None, status: None, will_mutate: None, replaced_text: None, node_id: None, node_name: None });
    }
    if req.action == "delete" && path.is_dir() {
        fs::remove_dir_all(&path)?;
        return Ok(MutationSuccess { ok: true, path: Some(normalize_path(&path.to_string_lossy())), hash: None, start_line: None, end_line: None, status: None, will_mutate: None, replaced_text: None, node_id: None, node_name: None });
    }

    let current = fs::read_to_string(&path)?;
    let mut original_nodes = Vec::new();
    if is_code_path(&path) {
        original_nodes = decompose_file_to_sections(&path.to_string_lossy(), &current);
    }
    
    let target = resolve_node(&original_nodes, req.node_id.as_deref(), req.node_name.as_deref());
    
    if let Some(base_hash) = &req.base_hash {
        let actual = if let Some(t) = target { t.base_hash.clone() } else { stable_hash(&current) };
        if actual != *base_hash { return Err(format!("hash-conflict:{actual}").into()); }
    }

    let start = target.map(|t| t.start_line).or(req.start_line).unwrap_or(1);
    let end = target.map(|t| t.end_line).or(req.end_line).unwrap_or_else(|| current.lines().count().max(1));

    if req.action == "move-node" {
        let dest_str = req.destination_path.as_deref().ok_or("missing destination_path")?;
        let dest_path = workspace.join(dest_str);
        
        let lines: Vec<&str> = current.split('\n').collect();
        let extracted_text = lines[start - 1..end].join("\n");
        let mut next_src_lines = lines[..start - 1].to_vec();
        next_src_lines.extend(&lines[end..]);
        let next_src = next_src_lines.join("\n");
        
        let current_dest = fs::read_to_string(&dest_path).unwrap_or_default();
        let insert_line = req.destination_line.unwrap_or_else(|| current_dest.lines().count().max(1) + 1);
        let mut dest_lines: Vec<&str> = current_dest.split('\n').collect();
        let mut next_dest_lines = dest_lines[..insert_line - 1].to_vec();
        let ext_lines: Vec<&str> = extracted_text.split('\n').collect();
        next_dest_lines.extend(ext_lines);
        if insert_line <= dest_lines.len() {
            next_dest_lines.extend(&dest_lines[insert_line - 1..]);
        }
        let next_dest = next_dest_lines.join("\n");
        
        if req.dry_run {
            return Ok(MutationSuccess { ok: true, path: Some(normalize_path(&dest_path.to_string_lossy())), status: Some("dry-run-preview".into()), will_mutate: Some(false), replaced_text: Some(extracted_text.clone()), start_line: Some(insert_line), end_line: Some(insert_line + extracted_text.lines().count().max(1) - 1), node_id: None, node_name: None, hash: None });
        }
        
        if let Some(t) = target {
            history.by_hash.insert(t.base_hash.clone(), extracted_text.clone());
            history.by_id.entry(t.id.clone()).or_default().push(t.base_hash.clone());
            history.by_name.entry(t.name.clone()).or_default().push(t.base_hash.clone());
        }
        
        if let Some(parent) = dest_path.parent() { fs::create_dir_all(parent)?; }
        fs::write(&path, &next_src)?;
        fs::write(&dest_path, &next_dest)?;
        save_history(workspace, &history);
        
        return Ok(MutationSuccess { ok: true, path: Some(normalize_path(&dest_path.to_string_lossy())), hash: Some(stable_hash(&next_dest)), start_line: Some(insert_line), end_line: Some(insert_line + extracted_text.lines().count().max(1) - 1), node_id: target.map(|t| t.id.clone()), node_name: target.map(|t| t.name.clone()), status: None, will_mutate: None, replaced_text: None });
    }

    let mut next = String::new();
    if req.action == "insert" {
        let lines: Vec<&str> = current.split('\n').collect();
        let insert_idx = start.max(1) - 1;
        let mut next_lines = lines[..insert_idx].to_vec();
        let content_val = req.content.clone().unwrap_or_default();
        let content_lines: Vec<&str> = content_val.split('\n').collect();
        next_lines.extend(content_lines);
        if insert_idx < lines.len() { next_lines.extend(&lines[insert_idx..]); }
        next = next_lines.join("\n");
    } else if req.action == "replace" {
        let lines: Vec<&str> = current.split('\n').collect();
        let original_lines = &lines[start - 1..end];
        
        if is_code_path(&path) && target.is_none() {
            if let Some(old_c) = &req.old_content {
                if original_lines.join("\n") != *old_c {
                    return Err("oldcontent-mismatch".into());
                }
            } else {
                return Err("structured-file-requires-nodeid-or-oldcontent".into());
            }
        }
        
        let replaced_text = original_lines.join("\n");
        let mut new_content = req.content.clone().unwrap_or_default();
        if !original_lines.is_empty() {
            if let Some(indent) = original_lines[0].chars().take_while(|c| c.is_whitespace()).map(|c| c.to_string()).reduce(|a,b| a+&b) {
                let clines: Vec<&str> = new_content.split('\n').collect();
                if !clines.is_empty() && !clines[0].starts_with(&indent) {
                    new_content = clines.into_iter().map(|l| if l.is_empty() { String::new() } else { format!("{}{}", indent, l) }).collect::<Vec<_>>().join("\n");
                }
            }
        }
        
        if let Some(t) = target {
            history.by_hash.insert(t.base_hash.clone(), replaced_text.clone());
            history.by_id.entry(t.id.clone()).or_default().push(t.base_hash.clone());
            history.by_name.entry(t.name.clone()).or_default().push(t.base_hash.clone());
        }
        
        if req.dry_run {
            return Ok(MutationSuccess { ok: true, path: Some(normalize_path(&path.to_string_lossy())), status: Some("dry-run-preview".into()), will_mutate: Some(false), replaced_text: Some(replaced_text), start_line: Some(start), end_line: Some(start + new_content.lines().count().max(1) - 1), node_id: None, node_name: None, hash: None });
        }
        
        let mut next_lines = lines[..start - 1].to_vec();
        let nlines: Vec<&str> = new_content.split('\n').collect();
        next_lines.extend(nlines);
        if end < lines.len() { next_lines.extend(&lines[end..]); }
        next = next_lines.join("\n");
    } else if req.action == "delete" {
        let lines: Vec<&str> = current.split('\n').collect();
        let replaced_text = lines[start - 1..end].join("\n");
        if let Some(t) = target {
            history.by_hash.insert(t.base_hash.clone(), replaced_text.clone());
            history.by_id.entry(t.id.clone()).or_default().push(t.base_hash.clone());
            history.by_name.entry(t.name.clone()).or_default().push(t.base_hash.clone());
        }
        if req.dry_run {
            return Ok(MutationSuccess { ok: true, path: Some(normalize_path(&path.to_string_lossy())), status: Some("dry-run-preview".into()), will_mutate: Some(false), replaced_text: Some(replaced_text), start_line: Some(start), end_line: Some(start), node_id: None, node_name: None, hash: None });
        }
        let mut next_lines = lines[..start - 1].to_vec();
        if end < lines.len() { next_lines.extend(&lines[end..]); }
        next = next_lines.join("\n");
    }
    
    fs::write(&path, &next)?;
    save_history(workspace, &history);
    
    let content_lines_count = next.lines().count().max(1);
    let final_end = if req.action == "replace" { start + req.content.unwrap_or_default().lines().count().max(1) - 1 } else { start };
    
    Ok(MutationSuccess { ok: true, path: Some(normalize_path(&path.to_string_lossy())), hash: Some(stable_hash(&next)), start_line: Some(start), end_line: Some(final_end), node_id: target.map(|t| t.id.clone()), node_name: target.map(|t| t.name.clone()), status: None, will_mutate: None, replaced_text: None })
}

fn resolve_node<'a>(nodes: &'a [StructuralNode], node_id: Option<&str>, node_name: Option<&str>) -> Option<&'a StructuralNode> {
    if let Some(nid) = node_id {
        return nodes.iter().find(|n| n.id == nid);
    }
    if let Some(nname) = node_name {
        let matches: Vec<_> = nodes.iter().filter(|n| n.name == nname).collect();
        if matches.len() == 1 { return Some(matches[0]); }
    }
    None
}
