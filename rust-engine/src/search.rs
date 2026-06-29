use crate::models::{Chunk, IndexMeta, SearchHit};
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Read;
use std::path::Path;

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let meta_path = Path::new(args.get(2).ok_or("missing meta path")?);
    let embeddings_path = Path::new(args.get(3).ok_or("missing embeddings path")?);
    let query = args.get(4).ok_or("missing query")?;
    let query_vec: Vec<f32> = serde_json::from_str(args.get(5).ok_or("missing vector")?)?;
    let top_k: usize = args.get(6).and_then(|v| v.parse().ok()).unwrap_or(5);
    let meta: IndexMeta = serde_json::from_reader(File::open(meta_path)?)?;
    let mut bytes = Vec::new();
    File::open(embeddings_path)?.read_to_end(&mut bytes)?;
    let vectors: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect();
    let bm25 = bm25_scores(&meta.chunks, query);
    let mut hits = Vec::new();
    for (index, chunk) in meta.chunks.iter().enumerate() {
        let start = index * meta.embed_dim;
        let cosine = if meta.embed_dim > 0 && start + meta.embed_dim <= vectors.len() {
            cosine_similarity(&query_vec, &vectors[start..start + meta.embed_dim])
        } else {
            0.0
        };
        hits.push(SearchHit {
            chunk: chunk.clone(),
            score: cosine * 0.7 + bm25[index] * 0.3,
        });
    }
    hits.sort_by(|a, b| b.score.total_cmp(&a.score));
    hits.truncate(top_k);
    println!("{}", serde_json::to_string(&hits)?);
    Ok(())
}

pub(crate) fn bm25_scores(chunks: &[Chunk], query: &str) -> Vec<f32> {
    let terms = tokenize(query);
    let docs: Vec<Vec<String>> = chunks
        .iter()
        .map(|c| {
            tokenize(&format!(
                "{} {} {}",
                c.name.as_deref().unwrap_or(""),
                c.kind.as_deref().unwrap_or(""),
                c.code
            ))
        })
        .collect();
    let avg = docs.iter().map(Vec::len).sum::<usize>() as f32 / docs.len().max(1) as f32;
    let mut df = HashMap::new();
    for doc in &docs {
        for term in doc.iter().collect::<HashSet<_>>() {
            *df.entry(term.clone()).or_insert(0usize) += 1
        }
    }
    let mut scores = vec![0.0; docs.len()];
    for (i, doc) in docs.iter().enumerate() {
        for term in &terms {
            let tf = doc.iter().filter(|v| *v == term).count() as f32;
            if tf == 0.0 {
                continue;
            }
            let freq = *df.get(term).unwrap_or(&0) as f32;
            let idf = (((docs.len() as f32 - freq + 0.5) / (freq + 0.5)) + 1.0).ln();
            scores[i] +=
                idf * (tf * 2.5) / (tf + 1.5 * (0.25 + 0.75 * doc.len() as f32 / avg.max(1.0)));
        }
    }
    let max = scores.iter().copied().fold(0.0f32, f32::max);
    if max > 0.0 {
        for score in &mut scores {
            *score /= max
        }
    }
    scores
}

pub(crate) fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let (mut dot, mut aa, mut bb) = (0.0, 0.0, 0.0);
    for i in 0..a.len() {
        dot += a[i] * b[i];
        aa += a[i] * a[i];
        bb += b[i] * b[i];
    }
    if aa == 0.0 || bb == 0.0 {
        0.0
    } else {
        dot / (aa.sqrt() * bb.sqrt())
    }
}

fn tokenize(value: &str) -> Vec<String> {
    value
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .filter(|v| v.len() > 1)
        .map(str::to_string)
        .collect()
}
