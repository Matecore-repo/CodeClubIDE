use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, BufRead, BufReader, BufWriter, Write};
use std::path::Path;

const DEFAULT_DIM: usize = 128;
const WINDOW_SIZE: usize = 5;
const NEGATIVE_SAMPLES: usize = 5;
const EPOCHS: usize = 5;
const INITIAL_ALPHA: f32 = 0.025;
const MIN_ALPHA: f32 = 0.0001;

pub fn run(args: &[String]) -> io::Result<()> {
    let mode = args.get(1).map(String::as_str).unwrap_or("");
    if mode == "train" {
        if args.len() < 4 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "missing train arguments",
            ));
        }
        let workspace = &args[2];
        let model_path = &args[3];
        let dim = if args.len() > 4 {
            args[4].parse().unwrap_or(DEFAULT_DIM)
        } else {
            DEFAULT_DIM
        };

        train_model(workspace, model_path, dim)?;
    } else if mode == "embed" {
        if args.len() < 4 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "missing embed arguments",
            ));
        }
        let model_path = &args[2];
        let json_input = &args[3];

        embed_texts(model_path, json_input)?;
    } else if mode == "rank" {
        if args.len() < 5 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "missing rank arguments",
            ));
        }
        let top_k = args.get(5).and_then(|v| v.parse().ok()).unwrap_or(3);
        rank_texts(&args[2], &args[3], &args[4], top_k)?;
    } else {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "unknown embed command",
        ));
    }

    Ok(())
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .filter(|s| s.len() > 1)
        .map(|s| s.to_string())
        .collect()
}

fn collect_corpus_files(dir: &Path, files: &mut Vec<String>) -> io::Result<()> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Ok(()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(name) = path.file_name() {
            let n = name.to_string_lossy();
            if n.starts_with('.') || n == "node_modules" || n == "dist" || n == "out" {
                continue;
            }
        }
        if path.is_dir() {
            collect_corpus_files(&path, files)?;
        } else {
            let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase());
            if let Some(e) = ext {
                if matches!(
                    e.as_str(),
                    "ts" | "tsx" | "js" | "jsx" | "rs" | "py" | "go" | "css" | "md"
                ) {
                    files.push(path.to_string_lossy().into_owned());
                }
            }
        }
    }
    Ok(())
}

fn train_model(workspace: &str, model_path: &str, dim: usize) -> io::Result<()> {
    let mut file_paths = Vec::new();
    collect_corpus_files(Path::new(workspace), &mut file_paths)?;

    // Read and tokenize corpus
    let mut sentences = Vec::new();
    let mut word_counts = HashMap::new();

    for path in &file_paths {
        if let Ok(file) = File::open(path) {
            let reader = BufReader::new(file);
            for line in reader.lines().flatten() {
                let tokens = tokenize(&line);
                if !tokens.is_empty() {
                    for t in &tokens {
                        *word_counts.entry(t.clone()).or_insert(0) += 1;
                    }
                    sentences.push(tokens);
                }
            }
        }
    }

    if sentences.is_empty() {
        // Create empty fallback model
        let mut f = File::create(model_path)?;
        writeln!(f, "0 {}", dim)?;
        return Ok(());
    }

    // Build vocabulary (filter words with frequency >= 2 for stability, fallback to >=1 if vocab is too small)
    let min_count = if word_counts.len() < 50 { 1 } else { 2 };
    let mut vocab = Vec::new();
    let mut word_to_idx = HashMap::new();
    let mut idx_to_word = Vec::new();

    for (word, count) in word_counts.iter() {
        if *count >= min_count {
            let idx = vocab.len();
            vocab.push((word.clone(), *count));
            word_to_idx.insert(word.clone(), idx);
            idx_to_word.push(word.clone());
        }
    }

    let vocab_size = vocab.len();
    if vocab_size == 0 {
        let mut f = File::create(model_path)?;
        writeln!(f, "0 {}", dim)?;
        return Ok(());
    }

    // Create unigram table for negative sampling
    let mut unigram_table = Vec::new();
    let mut power_sum = 0.0;
    for (_, count) in &vocab {
        power_sum += (*count as f64).powf(0.75);
    }
    for (idx, (_, count)) in vocab.iter().enumerate() {
        let share = (*count as f64).powf(0.75) / power_sum;
        let table_slots = (share * 1000000.0).round() as usize;
        for _ in 0..table_slots {
            unigram_table.push(idx);
        }
    }
    if unigram_table.is_empty() {
        unigram_table = (0..vocab_size).collect();
    }

    // Initialize weights
    // w1: input embeddings, w2: output weights (negative sampling)
    let mut w1 = vec![0.0f32; vocab_size * dim];
    let mut w2 = vec![0.0f32; vocab_size * dim];

    let mut seed: u32 = 42;
    fn lcg(seed: &mut u32) -> u32 {
        *seed = seed.wrapping_mul(1103515245).wrapping_add(12345);
        *seed
    }
    let next_random_val = |s: &mut u32| -> f32 {
        let r = (lcg(s) & 0xffff) as f32 / 65536.0;
        r - 0.5
    };

    for i in 0..w1.len() {
        w1[i] = next_random_val(&mut seed) / (dim as f32);
    }

    // Sigmoid helper (table for speed)
    let sigmoid_table_size = 1000;
    let mut sigmoid_table = Vec::with_capacity(sigmoid_table_size);
    for i in 0..sigmoid_table_size {
        let x = (i as f32 / sigmoid_table_size as f32) * 12.0 - 6.0; // -6.0 to 6.0
        let sig = 1.0 / (1.0 + (-x).exp());
        sigmoid_table.push(sig);
    }
    let get_sigmoid = |val: f32| -> f32 {
        if val <= -6.0 {
            0.0
        } else if val >= 6.0 {
            1.0
        } else {
            let idx = ((val + 6.0) / 12.0 * sigmoid_table_size as f32) as usize;
            sigmoid_table[idx.min(sigmoid_table_size - 1)]
        }
    };

    // Total words to train
    let mut total_words = 0;
    for s in &sentences {
        total_words += s.len();
    }

    let mut alpha = INITIAL_ALPHA;
    let mut trained_words = 0;

    // Train epochs
    for _epoch in 0..EPOCHS {
        for s in &sentences {
            let mut sentence_word_idxs = Vec::with_capacity(s.len());
            for word in s {
                if let Some(&idx) = word_to_idx.get(word) {
                    sentence_word_idxs.push(idx);
                }
            }

            for pos in 0..sentence_word_idxs.len() {
                let target = sentence_word_idxs[pos];

                // Dynamic window size (randomized for skip-gram)
                let current_seed = lcg(&mut seed);
                let curr_window = (current_seed % WINDOW_SIZE as u32) as usize + 1;

                let start = pos.saturating_sub(curr_window);
                let end = (pos + curr_window).min(sentence_word_idxs.len() - 1);

                for c_pos in start..=end {
                    if c_pos == pos {
                        continue;
                    }
                    let context = sentence_word_idxs[c_pos];

                    // Train pair: predict context word context from target word target
                    // W1 has context words as inputs or output representation?
                    // Standard Skip-gram predicts context word c from target word t:
                    // input: target, target_vec = w1[target]
                    // output: context, context_vec = w2[context]
                    let target_offset = target * dim;

                    let mut neu1e = vec![0.0f32; dim]; // Gradient accumulator

                    // 1. Positive case
                    let context_offset = context * dim;
                    let mut dot = 0.0f32;
                    for d in 0..dim {
                        dot += w1[target_offset + d] * w2[context_offset + d];
                    }
                    let sig = get_sigmoid(dot);
                    let g = (1.0 - sig) * alpha;
                    for d in 0..dim {
                        neu1e[d] += g * w2[context_offset + d];
                        w2[context_offset + d] += g * w1[target_offset + d];
                    }

                    // 2. Negative cases
                    for _ in 0..NEGATIVE_SAMPLES {
                        // Draw negative sample
                        let current_neg_seed = lcg(&mut seed);
                        let neg_idx =
                            unigram_table[(current_neg_seed as usize) % unigram_table.len()];
                        if neg_idx == context {
                            continue;
                        }

                        let neg_offset = neg_idx * dim;
                        let mut dot_neg = 0.0f32;
                        for d in 0..dim {
                            dot_neg += w1[target_offset + d] * w2[neg_offset + d];
                        }
                        let sig_neg = get_sigmoid(dot_neg);
                        let g_neg = (0.0 - sig_neg) * alpha;
                        for d in 0..dim {
                            neu1e[d] += g_neg * w2[neg_offset + d];
                            w2[neg_offset + d] += g_neg * w1[target_offset + d];
                        }
                    }

                    // Update input representation
                    for d in 0..dim {
                        w1[target_offset + d] += neu1e[d];
                    }
                }
                trained_words += 1;
                if trained_words % 10000 == 0 {
                    let progress = trained_words as f32 / (total_words * EPOCHS) as f32;
                    alpha = INITIAL_ALPHA * (1.0 - progress);
                    if alpha < MIN_ALPHA {
                        alpha = MIN_ALPHA;
                    }
                }
            }
        }
    }

    // Save vectors to file
    let mut file = BufWriter::new(File::create(model_path)?);
    writeln!(file, "{} {}", vocab_size, dim)?;
    for i in 0..vocab_size {
        write!(file, "{}", idx_to_word[i])?;
        let offset = i * dim;
        for d in 0..dim {
            write!(file, " {:.6}", w1[offset + d])?;
        }
        writeln!(file)?;
    }
    file.flush()?;

    Ok(())
}

fn embed_texts(model_path: &str, json_input: &str) -> io::Result<()> {
    // Parse json array of strings
    // E.g., ["fn test()", "import react"]
    // Since we don't want external dependencies (like serde_json), we can parse this simple structure manually
    let parsed_texts = parse_json_string_array(json_input);

    // Load model
    let mut vocab = HashMap::new();
    let mut dim = DEFAULT_DIM;

    if Path::new(model_path).exists() {
        if let Ok(file) = File::open(model_path) {
            let reader = BufReader::new(file);
            let mut lines = reader.lines().flatten();
            if let Some(header) = lines.next() {
                let parts: Vec<&str> = header.split_whitespace().collect();
                if parts.len() >= 2 {
                    dim = parts[1].parse().unwrap_or(DEFAULT_DIM);
                }
            }

            for line in lines {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= dim + 1 {
                    let word = parts[0].to_string();
                    let mut vec = Vec::with_capacity(dim);
                    for i in 1..=dim {
                        vec.push(parts[i].parse::<f32>().unwrap_or(0.0));
                    }
                    vocab.insert(word, vec);
                }
            }
        }
    }

    // For each text, tokenize, average the word vectors, normalize, and collect
    let mut results = Vec::new();
    for text in parsed_texts {
        let tokens = tokenize(&text);
        let mut sum_vec = vec![0.0f32; dim];
        let mut count = 0;

        for t in tokens {
            if let Some(vec) = vocab.get(&t) {
                for d in 0..dim {
                    sum_vec[d] += vec[d];
                }
                count += 1;
            }
        }

        if count > 0 {
            // L2 Normalize
            let mut mag = 0.0f32;
            for d in 0..dim {
                mag += sum_vec[d] * sum_vec[d];
            }
            mag = mag.sqrt();
            if mag > 0.0 {
                for d in 0..dim {
                    sum_vec[d] /= mag;
                }
            }
        } else {
            // Fallback: Uniform small random or zeroes if no words in vocab
            // Zeroes are fine, but tiny values prevent division by zero in cosine similarity
            let mut next_val = 0.1f32;
            for d in 0..dim {
                sum_vec[d] = next_val;
                next_val = -next_val * 0.95; // some diversity
            }
            let mut mag = 0.0f32;
            for d in 0..dim {
                mag += sum_vec[d] * sum_vec[d];
            }
            mag = mag.sqrt();
            if mag > 0.0 {
                for d in 0..dim {
                    sum_vec[d] /= mag;
                }
            }
        }
        results.push(sum_vec);
    }

    // Output JSON array of float arrays
    print!("[");
    for (i, vec) in results.iter().enumerate() {
        if i > 0 {
            print!(",");
        }
        print!("[");
        for (j, val) in vec.iter().enumerate() {
            if j > 0 {
                print!(",");
            }
            print!("{:.6}", val);
        }
        print!("]");
    }
    print!("]");

    Ok(())
}

fn rank_texts(model_path: &str, query: &str, json_documents: &str, top_k: usize) -> io::Result<()> {
    let mut texts = vec![query.to_string()];
    texts.extend(parse_json_string_array(json_documents));
    let vectors = vectors_for_texts(model_path, &texts);
    if vectors.len() < 2 {
        print!("[]");
        return Ok(());
    }
    let query_vector = &vectors[0];
    let mut scores: Vec<(usize, f32)> = vectors[1..]
        .iter()
        .enumerate()
        .map(|(index, vector)| {
            let score = query_vector.iter().zip(vector).map(|(a, b)| a * b).sum();
            (index, score)
        })
        .collect();
    scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scores.truncate(top_k.max(1).min(5));
    print!("[");
    for (position, (index, score)) in scores.iter().enumerate() {
        if position > 0 {
            print!(",");
        }
        print!("{{\"index\":{},\"score\":{:.6}}}", index, score);
    }
    print!("]");
    Ok(())
}

fn vectors_for_texts(model_path: &str, texts: &[String]) -> Vec<Vec<f32>> {
    let mut vocab = HashMap::new();
    let mut dim = DEFAULT_DIM;
    if let Ok(file) = File::open(model_path) {
        let reader = BufReader::new(file);
        let mut lines = reader.lines().flatten();
        if let Some(header) = lines.next() {
            let parts: Vec<&str> = header.split_whitespace().collect();
            if parts.len() >= 2 {
                dim = parts[1].parse().unwrap_or(DEFAULT_DIM);
            }
        }
        for line in lines {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= dim + 1 {
                vocab.insert(
                    parts[0].to_string(),
                    (1..=dim)
                        .map(|i| parts[i].parse().unwrap_or(0.0))
                        .collect::<Vec<f32>>(),
                );
            }
        }
    }
    texts
        .iter()
        .map(|text| {
            let mut vector = vec![0.0f32; dim];
            let mut count = 0;
            for token in tokenize(text) {
                if let Some(word_vector) = vocab.get(&token) {
                    for d in 0..dim {
                        vector[d] += word_vector[d];
                    }
                    count += 1;
                }
            }
            if count == 0 {
                let mut value = 0.1f32;
                for item in &mut vector {
                    *item = value;
                    value = -value * 0.95;
                }
            }
            let magnitude = vector.iter().map(|v| v * v).sum::<f32>().sqrt();
            if magnitude > 0.0 {
                for item in &mut vector {
                    *item /= magnitude;
                }
            }
            vector
        })
        .collect()
}

fn parse_json_string_array(json: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    let mut in_string = false;
    let mut escaped = false;

    for c in json.chars() {
        if escaped {
            current.push(c);
            escaped = false;
        } else if c == '\\' {
            escaped = true;
        } else if c == '"' {
            if in_string {
                out.push(current.clone());
                current.clear();
                in_string = false;
            } else {
                in_string = true;
            }
        } else if in_string {
            current.push(c);
        }
    }
    out
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if let Err(e) = run(&args) {
        eprintln!("embed: {}", e);
        std::process::exit(1);
    }
}
