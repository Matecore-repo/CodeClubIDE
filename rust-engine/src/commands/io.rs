use std::fs;
use std::io::{self, Read};
use std::path::Path;
use serde::Deserialize;

#[derive(Deserialize)]
struct EditRequest {
    #[serde(rename = "oldContent")]
    old_content: String,
    content: String,
}

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let subcmd = args.get(2).map(String::as_str).ok_or("Missing io subcommand")?;
    let path_str = args.get(3).ok_or("Missing path")?;
    let path = Path::new(path_str);

    match subcmd {
        "read-file" => {
            let content = fs::read_to_string(path)?;
            print!("{}", content);
        }
        "write-file" => {
            let mut content = String::new();
            io::stdin().read_to_string(&mut content)?;
            fs::write(path, content)?;
            println!(r#"{{"ok":true}}"#);
        }
        "delete-file" => {
            if path.is_dir() {
                fs::remove_dir_all(path)?;
            } else {
                fs::remove_file(path)?;
            }
            println!(r#"{{"ok":true}}"#);
        }
        "edit-file" => {
            let mut stdin_content = String::new();
            io::stdin().read_to_string(&mut stdin_content)?;
            let req: EditRequest = serde_json::from_str(&stdin_content)?;
            
            let current = fs::read_to_string(path)?;
            if let Some(pos) = current.find(&req.old_content) {
                if current[pos + req.old_content.len()..].find(&req.old_content).is_some() {
                    return Err("Error: oldContent must occur exactly once.".into());
                }
                let mut new_content = String::with_capacity(current.len() - req.old_content.len() + req.content.len());
                new_content.push_str(&current[..pos]);
                new_content.push_str(&req.content);
                new_content.push_str(&current[pos + req.old_content.len()..]);
                fs::write(path, new_content)?;
                println!(r#"{{"ok":true}}"#);
            } else {
                return Err("Error: oldContent not found.".into());
            }
        }
        _ => return Err(format!("Unknown io subcommand: {}", subcmd).into()),
    }

    Ok(())
}
