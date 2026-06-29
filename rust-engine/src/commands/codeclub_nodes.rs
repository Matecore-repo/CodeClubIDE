use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct StructuralNode {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub ancestors: Vec<String>,
    #[serde(rename = "startLine")]
    pub start_line: usize,
    #[serde(rename = "endLine")]
    pub end_line: usize,
    pub content: String,
    #[serde(rename = "baseHash")]
    pub base_hash: String,
}

#[derive(Serialize)]
struct OpResult {
    ok: bool,
    reason: Option<String>,
}

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    match args.get(1).map(String::as_str) {
        Some("codeclub-nodes") => list_nodes(args),
        Some("codeclub-append") => append_node(args),
        Some("codeclub-replace-range") => replace_range(args),
        _ => Err(
            "Usage: codeclub-engine <codeclub-nodes|codeclub-append|codeclub-replace-range> ..."
                .into(),
        ),
    }
}

fn list_nodes(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let file_path = args.get(2).ok_or("missing file path")?;
    let content = fs::read_to_string(file_path)?;
    let nodes = decompose_file_to_sections(file_path, &content);
    println!("{}", serde_json::to_string(&nodes)?);
    Ok(())
}

fn append_node(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let file_path = args.get(2).ok_or("missing file path")?;
    let content = args.get(3).ok_or("missing content")?.trim_end();
    let current = fs::read_to_string(file_path).unwrap_or_default();
    let sep = if current.ends_with('\n') || current.is_empty() {
        ""
    } else {
        "\n"
    };
    match fs::write(file_path, format!("{current}{sep}{content}\n")) {
        Ok(_) => print_result(true, None),
        Err(_) => print_result(false, Some("append-failed")),
    }
}

fn replace_range(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let file_path = args.get(2).ok_or("missing file path")?;
    let start_line = args.get(3).ok_or("missing start line")?.parse::<usize>()?;
    let end_line = args.get(4).ok_or("missing end line")?.parse::<usize>()?;
    let replacement = args.get(5).ok_or("missing content")?.trim_end();
    let current = match fs::read_to_string(file_path) {
        Ok(value) => value,
        Err(_) => return print_result(false, Some("replace-range-failed")),
    };
    let lines: Vec<&str> = current.split('\n').collect();
    if start_line < 1 || end_line < start_line || start_line > lines.len() {
        return print_result(false, Some("range-out-of-bounds"));
    }

    let mut next: Vec<String> = Vec::new();
    next.extend(
        lines[..start_line - 1]
            .iter()
            .map(|line| (*line).to_string()),
    );
    if !replacement.is_empty() {
        next.extend(replacement.split('\n').map(|line| line.to_string()));
    }
    next.extend(lines[end_line..].iter().map(|line| (*line).to_string()));

    match fs::write(file_path, next.join("\n")) {
        Ok(_) => print_result(true, None),
        Err(_) => print_result(false, Some("replace-range-failed")),
    }
}

fn print_result(ok: bool, reason: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
    println!(
        "{}",
        serde_json::to_string(&OpResult {
            ok,
            reason: reason.map(str::to_string)
        })?
    );
    Ok(())
}

pub fn decompose_file_to_sections(file_path: &str, content: &str) -> Vec<StructuralNode> {
    let lines: Vec<&str> = content.split('\n').collect();
    let ext = Path::new(file_path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mut sections = Vec::new();

    if matches!(
        ext.as_str(),
        "ts" | "tsx"
            | "js"
            | "jsx"
            | "py"
            | "rs"
            | "go"
            | "c"
            | "h"
            | "cpp"
            | "hpp"
            | "java"
            | "cs"
            | "rb"
    ) {
        let declarations: Vec<(usize, String, String)> = lines
            .iter()
            .enumerate()
            .filter_map(|(idx, line)| {
                code_declaration(line).map(|(kind, name)| (idx, kind.to_string(), name))
            })
            .collect();
        for (position, (start, kind, name)) in declarations.iter().enumerate() {
            let fallback_end = declarations
                .get(position + 1)
                .map(|next| next.0.saturating_sub(1))
                .unwrap_or_else(|| lines.len().saturating_sub(1));
            let end = code_block_end(&lines, *start).unwrap_or(fallback_end).min(fallback_end);
            push_section(
                &mut sections,
                file_path,
                name.clone(),
                kind,
                *start,
                end,
                &lines,
            );
        }
        if !sections.is_empty() {
            return sections;
        }
    }

    if ext == "md" {
        for (idx, line) in lines.iter().enumerate() {
            let trimmed = line.trim_start();
            if !trimmed.starts_with('#') {
                continue;
            }
            let name = trimmed.trim_start_matches('#').trim();
            if name.is_empty() {
                continue;
            }
            let end = find_next(&lines, idx + 1, |line| line.trim_start().starts_with('#'));
            push_section(
                &mut sections,
                file_path,
                name.chars().take(40).collect(),
                "section",
                idx,
                end,
                &lines,
            );
        }
        if !sections.is_empty() {
            return sections;
        }
    }

    if matches!(ext.as_str(), "json" | "yaml" | "yml" | "toml") {
        for (idx, line) in lines.iter().enumerate() {
            let trimmed = line.trim_start_matches(['"', '\'']);
            let Some(split) = trimmed.find([':', '=']) else {
                continue;
            };
            let name = trimmed[..split].trim_matches(['"', '\'', ' ']);
            if name.is_empty() || name.contains(' ') {
                continue;
            }
            let end = find_next(&lines, idx + 1, |line| {
                let trimmed = line.trim_start_matches(['"', '\'']);
                trimmed.find([':', '=']).is_some_and(|pos| {
                    let key = trimmed[..pos].trim_matches(['"', '\'', ' ']);
                    !key.is_empty() && !key.contains(' ')
                })
            });
            push_section(
                &mut sections,
                file_path,
                name.to_string(),
                "section",
                idx,
                end,
                &lines,
            );
        }
        if !sections.is_empty() {
            return sections;
        }
    }

    let block_size = 50;
    let mut start = 0;
    while start < lines.len() {
        let end = (start + block_size).min(lines.len()).saturating_sub(1);
        push_section(
            &mut sections,
            file_path,
            format!("block-{}:{}", start + 1, end + 1),
            "block",
            start,
            end,
            &lines,
        );
        if end >= lines.len().saturating_sub(1) {
            break;
        }
        start += block_size;
    }
    sections
}

fn code_block_end(lines: &[&str], start: usize) -> Option<usize> {
    let mut depth = 0isize;
    let mut opened = false;
    for (idx, line) in lines.iter().enumerate().skip(start) {
        for ch in line.chars() {
            if ch == '{' {
                depth += 1;
                opened = true;
            } else if ch == '}' && opened {
                depth -= 1;
            }
        }
        if opened && depth == 0 {
            return Some(idx);
        }
    }
    None
}

fn code_declaration(line: &str) -> Option<(&'static str, String)> {
    let mut value = line.trim_start();
    for prefix in [
        "export ",
        "public ",
        "private ",
        "protected ",
        "static ",
        "async ",
    ] {
        if value.starts_with(prefix) {
            value = value[prefix.len()..].trim_start();
        }
    }
    for (prefix, kind) in [
        ("class ", "class"),
        ("interface ", "interface"),
        ("struct ", "other"),
        ("enum ", "other"),
        ("trait ", "other"),
    ] {
        if let Some(rest) = value.strip_prefix(prefix) {
            return identifier(rest).map(|name| (kind, name));
        }
    }
    for prefix in ["function ", "def ", "fn ", "func "] {
        if let Some(rest) = value.strip_prefix(prefix) {
            return identifier(rest).map(|name| ("function", name));
        }
    }
    None
}

fn identifier(value: &str) -> Option<String> {
    let name: String = value
        .chars()
        .take_while(|ch| ch.is_alphanumeric() || *ch == '_' || *ch == '$')
        .collect();
    (!name.is_empty()).then_some(name)
}

fn push_section(
    sections: &mut Vec<StructuralNode>,
    file_path: &str,
    name: String,
    node_type: &str,
    start: usize,
    end: usize,
    lines: &[&str],
) {
    let content = lines[start..=end].join("\n");
    if content.trim().is_empty() {
        return;
    }
    sections.push(StructuralNode {
        id: stable_hash(
            &[
                normalize_path(file_path).to_lowercase(),
                node_type.to_string(),
                name.clone(),
            ]
            .join("\u{001f}"),
        ),
        name,
        node_type: node_type.to_string(),
        ancestors: Vec::new(),
        start_line: start + 1,
        end_line: end + 1,
        base_hash: stable_hash(&content),
        content,
    });
}

fn find_next(lines: &[&str], start: usize, pred: impl Fn(&str) -> bool) -> usize {
    for idx in start..lines.len() {
        if pred(lines[idx]) {
            return idx.saturating_sub(1);
        }
    }
    lines.len().saturating_sub(1)
}

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

#[cfg(test)]
mod tests {
    use super::{code_block_end, code_declaration};

    #[test]
    fn recognizes_common_code_nodes() {
        assert_eq!(
            code_declaration("export class Editor {").unwrap(),
            ("class", "Editor".into())
        );
        assert_eq!(
            code_declaration("async function readNode() {").unwrap(),
            ("function", "readNode".into())
        );
        assert_eq!(
            code_declaration("fn main() {").unwrap(),
            ("function", "main".into())
        );
    }

    #[test]
    fn ends_a_function_at_its_closing_brace() {
        let lines = ["function greet() {", "  return 'hello'", "}", "globalThis.greet = greet"];
        assert_eq!(code_block_end(&lines, 0), Some(2));
    }
}
