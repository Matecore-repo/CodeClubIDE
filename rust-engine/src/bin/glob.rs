use std::env;
use std::fs;
use std::path::{Path};
use std::io::{self, Write};

fn main() -> io::Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <directory>", args[0]);
        std::process::exit(1);
    }

    let base_dir_str = &args[1];
    let base_dir = Path::new(base_dir_str);
    if !base_dir.is_dir() {
        eprintln!("Error: {} is not a directory", base_dir_str);
        std::process::exit(1);
    }

    let stdout = io::stdout();
    let mut handle = io::BufWriter::new(stdout.lock());

    walk_dir(base_dir, base_dir, &mut handle)?;
    handle.flush()?;

    Ok(())
}

fn walk_dir(dir: &Path, base_dir: &Path, writer: &mut io::BufWriter<io::StdoutLock>) -> io::Result<()> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(file_name) = path.file_name() {
                let name_str = file_name.to_string_lossy();
                
                // Omitir ocultos y node_modules
                if name_str.starts_with('.') || name_str == "node_modules" {
                    continue;
                }
            }

            if path.is_dir() {
                let _ = walk_dir(&path, base_dir, writer);
            } else if path.is_file() {
                if let Ok(rel_path) = path.strip_prefix(base_dir) {
                    let rel_str = rel_path.to_string_lossy().replace('\\', "/");
                    let _ = writeln!(writer, "{}", rel_str);
                }
            }
        }
    }
    Ok(())
}
