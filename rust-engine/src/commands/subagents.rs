use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io::{self, Read};
use std::time::{Duration, Instant};
use tungstenite::{connect, Message};
use uuid::Uuid;

#[derive(Deserialize)]
struct AgentSpec {
    role: String,
    task: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubagentsRequest {
    agents: Vec<AgentSpec>,
    target_workspace: Option<String>,
}

#[derive(Serialize)]
struct SubagentReport {
    id: String,
    role: String,
    report: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SubagentsResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    reports: Vec<SubagentReport>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pending: Vec<String>,
}

pub fn run(args: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let port = args.get(2).ok_or("Missing port")?;
    let workspace_path = args.get(3).ok_or("Missing workspace path")?;
    let req_b64 = args.get(4).ok_or("Missing base64 args")?;
    
    use base64::{engine::general_purpose, Engine as _};
    let json_bytes = general_purpose::STANDARD.decode(req_b64)?;
    let stdin_content = String::from_utf8(json_bytes)?;
    let req: SubagentsRequest = serde_json::from_str(&stdin_content)?;

    let target_workspace = resolve_workspace(workspace_path, req.target_workspace.as_deref());

    let ws_url = format!("ws://localhost:{}", port);

    let (mut socket, _) = match connect(ws_url) {
        Ok(s) => s,
        Err(_) => {
            println!("{}", serde_json::to_string(&SubagentsResult {
                ok: false,
                error: Some("swarm-connection-failed".to_string()),
                reports: vec![],
                pending: vec![],
            })?);
            return Ok(());
        }
    };

    let principal_id = Uuid::new_v4().to_string();
    let register_msg = serde_json::json!({
        "type": "register",
        "payload": {
            "role": format!("principal-{}", principal_id)
        }
    });
    socket.write(Message::Text(register_msg.to_string().into()))?;

    let mut pending = HashSet::new();
    let mut roles = HashMap::new();

    for agent in req.agents {
        let id = Uuid::new_v4().to_string();
        pending.insert(id.clone());
        roles.insert(id.clone(), agent.role.clone());

        let prompt = format!(
            "ROLE: {}\nTASK: {}\nWORKSPACE: {}\n\nWork autonomously within this scope. Use the available file and search tools; terminal and subagents are unavailable. Make changes only when the task requests them. Verify with available evidence and finish with a concise report for the principal agent.",
            agent.role, agent.task, target_workspace
        );

        let spawn_msg = serde_json::json!({
            "type": "spawn_agent",
            "payload": {
                "id": id,
                "role": agent.role,
                "prompt": prompt,
                "workspacePath": target_workspace,
                "excludeTools": ["terminal", "subagents"]
            }
        });
        socket.write(Message::Text(spawn_msg.to_string().into()))?;
    }

    let mut reports = Vec::new();
    let timeout = Duration::from_secs(120);
    let start = Instant::now();

    while !pending.is_empty() {
        if start.elapsed() > timeout {
            println!("{}", serde_json::to_string(&SubagentsResult {
                ok: false,
                error: Some("subagent-timeout".to_string()),
                reports,
                pending: pending.into_iter().collect(),
            })?);
            return Ok(());
        }

        match socket.read() {
            Ok(Message::Text(text)) => {
                if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&text) {
                    if msg["type"].as_str() == Some("agent_done") {
                        if let Some(payload) = msg.get("payload") {
                            if let Some(id) = payload["id"].as_str() {
                                if pending.remove(id) {
                                    let role = roles.get(id).cloned().unwrap_or_else(|| "subagent".to_string());
                                    let mut final_report = "No final report.".to_string();
                                    
                                    if let Some(result_arr) = payload["result"].as_array() {
                                        for item in result_arr.iter().rev() {
                                            if item["role"].as_str() == Some("assistant") {
                                                if let Some(content) = item["content"].as_str() {
                                                    if !content.is_empty() {
                                                        final_report = content.to_string();
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    
                                    reports.push(SubagentReport {
                                        id: id.to_string(),
                                        role,
                                        report: final_report,
                                    });
                                }
                            }
                        }
                    }
                }
            }
            Ok(Message::Close(_)) | Err(_) => {
                println!("{}", serde_json::to_string(&SubagentsResult {
                    ok: false,
                    error: Some("swarm-connection-closed".to_string()),
                    reports,
                    pending: pending.into_iter().collect(),
                })?);
                return Ok(());
            }
            _ => {}
        }
    }

    let _ = socket.close(None);

    println!("{}", serde_json::to_string(&SubagentsResult {
        ok: true,
        error: None,
        reports,
        pending: vec![],
    })?);

    Ok(())
}

fn resolve_workspace(workspace_path: &str, target: Option<&str>) -> String {
    let target = match target {
        Some(t) => t,
        None => return workspace_path.to_string(),
    };
    if target.starts_with('/') || (target.len() >= 2 && target.chars().nth(1) == Some(':')) {
        target.replace('\\', "/")
    } else {
        format!("{}/{}", workspace_path, target)
            .replace('\\', "/")
            .replace("//", "/")
    }
}
