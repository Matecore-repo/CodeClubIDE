use std::env;

mod commands;
mod codegraph;
mod dap;
#[path = "bin/embed.rs"]
mod embed;
mod models;
mod search;
mod utils;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("scan") => commands::scan::run(&args),
        Some("search") => search::run(&args),
        Some("read-range") => commands::read_range::run(&args),
        Some("diff") => commands::diff::run(&args),
        Some("io") => commands::io::run(&args),
        Some("exec") => commands::exec::run(&args),
        Some("grep") => commands::grep::run(&args),
        Some("topographic") => commands::topographic::run(&args),
        Some("subagents") => commands::subagents::run(&args),
        Some("codeclub-nodes" | "codeclub-append" | "codeclub-replace-range") => commands::codeclub_nodes::run(&args),
        Some("dap-proxy") => dap::run(&args),
        Some("train") | Some("embed") | Some("rank") => Ok(embed::run(&args)?),
        _ => Err("Usage: codeclub-engine <scan|search|read-range|diff|io|exec|grep|codeclub-nodes|codeclub-append|codeclub-replace-range|dap-proxy|train|embed|rank|subagents> ...".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Chunk;

    #[test]
    fn stable_hash() {
        assert_eq!(blake3::hash(b"abc"), blake3::hash(b"abc"));
    }
    #[test]
    fn cosine_identity() {
        assert!((search::cosine_similarity(&[1.0, 0.0], &[1.0, 0.0]) - 1.0).abs() < 0.001);
    }
    #[test]
    fn bm25_prefers_match() {
        let make = |code: &str| Chunk {
            id: "x".into(),
            file_path: "x".into(),
            start_line: 1,
            end_line: 1,
            code: code.into(),
            kind: None,
            name: None,
            imports: None,
            outbound_calls: None,
            hash: "x".into(),
            modified_at: 0,
        };
        let scores = search::bm25_scores(&[make("alpha beta"), make("gamma")], "alpha");
        assert!(scores[0] > scores[1]);
    }
}
