use regex::Regex;
use std::fs;
use std::path::{Path, PathBuf};

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let path_str = args.get(2).ok_or("Missing path")?;
    let pattern = args.get(3).ok_or("Missing pattern")?;
    let root = Path::new(path_str);
    
    let regex = Regex::new(&format!("(?i){}", pattern))?;
    let mut results = Vec::new();
    let mut total_chars = 0;

    let mut dirs_to_visit = vec![root.to_path_buf()];

    while let Some(dir) = dirs_to_visit.pop() {
        if total_chars >= 15000 || results.len() >= 100 {
            break;
        }
        
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if path.is_dir() {
                if !name.starts_with('.') && name != "node_modules" {
                    dirs_to_visit.push(path);
                }
            } else {
                if let Ok(content) = fs::read_to_string(&path) {
                    for (i, line) in content.lines().enumerate() {
                        if results.len() >= 100 || total_chars >= 15000 {
                            break;
                        }
                        if regex.is_match(line) {
                            let rel_path = path.strip_prefix(root).unwrap_or(&path).to_string_lossy().replace("\\", "/");
                            let match_str = format!("{}:{}: {:.200}", rel_path, i + 1, line.trim());
                            total_chars += match_str.len();
                            results.push(match_str);
                        }
                    }
                }
            }
        }
    }

    if total_chars >= 15000 {
        results.push("\n...[TRUNCATED] Too many matches.".to_string());
    }

    for res in results {
        println!("{}", res);
    }

    Ok(())
}
