use std::process::Command;
use serde::Serialize;
use std::env;

#[derive(Serialize)]
struct ExecResult {
    exitCode: i32,
    stdout: String,
    stderr: String,
}

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let command_str = args.get(2).ok_or("Missing command")?;
    let cwd = args.get(3).map(|s| s.as_str()).unwrap_or(".");

    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(&["/C", command_str]);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(&["-c", command_str]);
        c
    };

    cmd.current_dir(cwd);

    let output = cmd.output()?;

    let res = ExecResult {
        exitCode: output.status.code().unwrap_or(if output.status.success() { 0 } else { 1 }),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    };

    println!("{}", serde_json::to_string(&res)?);

    Ok(())
}
