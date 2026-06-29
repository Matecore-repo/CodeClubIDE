use std::io::{self, BufRead, Read, Write};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let command: Vec<String> = serde_json::from_str(args.get(2).ok_or("missing adapter command")?)?;
    let cwd = args.get(3).ok_or("missing cwd")?;
    if command.is_empty() {
        return Err("empty adapter command".into());
    }
    let mut child = Command::new(&command[0])
        .args(&command[1..])
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()?;
    let adapter_stdin = Arc::new(Mutex::new(
        child.stdin.take().ok_or("adapter stdin unavailable")?,
    ));
    let writer = Arc::clone(&adapter_stdin);
    thread::spawn(move || {
        for line in io::stdin().lock().lines().map_while(Result::ok) {
            let Ok(message) = serde_json::from_str::<serde_json::Value>(&line) else {
                continue;
            };
            let body = serde_json::to_vec(&message).unwrap_or_default();
            let mut input = writer.lock().unwrap();
            let _ = write!(input, "Content-Length: {}\r\n\r\n", body.len());
            let _ = input.write_all(&body);
            let _ = input.flush();
        }
    });
    let mut adapter_out = child.stdout.take().ok_or("adapter stdout unavailable")?;
    let mut stdout = io::BufWriter::new(io::stdout().lock());
    loop {
        let mut header = Vec::new();
        let mut byte = [0u8; 1];
        while adapter_out.read_exact(&mut byte).is_ok() {
            header.push(byte[0]);
            if header.ends_with(b"\r\n\r\n") {
                break;
            }
        }
        if header.is_empty() {
            break;
        }
        let text = String::from_utf8_lossy(&header);
        let length = text
            .lines()
            .find_map(|line| line.strip_prefix("Content-Length:"))
            .and_then(|value| value.trim().parse::<usize>().ok())
            .ok_or("invalid DAP header")?;
        let mut body = vec![0; length];
        adapter_out.read_exact(&mut body)?;
        stdout.write_all(&body)?;
        stdout.write_all(b"\n")?;
        stdout.flush()?;
    }
    let _ = child.wait();
    Ok(())
}
