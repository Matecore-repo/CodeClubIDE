use std::env;
use std::fs::{self, File};
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path};

fn main() -> io::Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: {} <directory> <pattern>", args[0]);
        std::process::exit(1);
    }

    let base_dir_str = &args[1];
    let pattern = args[2].to_lowercase();
    let base_dir = Path::new(base_dir_str);

    if !base_dir.is_dir() {
        eprintln!("Error: {} is not a directory", base_dir_str);
        std::process::exit(1);
    }

    let stdout = io::stdout();
    let mut handle = io::BufWriter::new(stdout.lock());

    walk_grep(base_dir, base_dir, &pattern, &mut handle)?;
    handle.flush()?;

    Ok(())
}

fn walk_grep(dir: &Path, base_dir: &Path, pattern_lower: &str, writer: &mut io::BufWriter<io::StdoutLock>) -> io::Result<()> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(file_name) = path.file_name() {
                let name_str = file_name.to_string_lossy();
                if name_str.starts_with('.') || name_str == "node_modules" {
                    continue;
                }
            }

            if path.is_dir() {
                let _ = walk_grep(&path, base_dir, pattern_lower, writer);
            } else if path.is_file() {
                if let Ok(file) = File::open(&path) {
                    let reader = BufReader::new(file);
                    for (index, line_result) in reader.lines().enumerate() {
                        if let Ok(line) = line_result {
                            if line.to_lowercase().contains(pattern_lower) {
                                if let Ok(rel_path) = path.strip_prefix(base_dir) {
                                    let rel_str = rel_path.to_string_lossy().replace('\\', "/");
                                    let trimmed = line.trim();
                                    let snippet = if trimmed.len() > 200 { &trimmed[..200] } else { trimmed };
                                    let _ = writeln!(writer, "{}:{}: {}", rel_str, index + 1, snippet);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}
