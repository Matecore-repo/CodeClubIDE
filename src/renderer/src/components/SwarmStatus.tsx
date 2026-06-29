import { useState, useEffect } from "react";
import type { SwarmAgentStatus } from "../hooks/useSwarmWorker";

const statusColors: Record<string, string> = {
  idle: "#777780",
  running: "#e0895e",
  tool: "#7c5cbf",
  done: "#4caf50",
  error: "#f44336",
};

export function SwarmStatus({
  agents,
  _onKillAgent,
  onClearAgents,
}: {
  agents: SwarmAgentStatus[];
  _onKillAgent: (id: string) => void;
  onClearAgents: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const handleToggle = () => setOpen((prev) => !prev);
    const handleOpen = () => {
      setOpen(true);
      setExpanded(true);
    };
    window.addEventListener("codeclub:toggle-swarm", handleToggle);
    window.addEventListener("codeclub:open-swarm", handleOpen);
    return () => {
      window.removeEventListener("codeclub:toggle-swarm", handleToggle);
      window.removeEventListener("codeclub:open-swarm", handleOpen);
    };
  }, []);

  // Auto-open when new agents appear if we are closed
  useEffect(() => {
    if (agents.length > 0 && !open) {
      setOpen(true);
      setExpanded(true);
    }
  }, [agents.length, open]);

  if (!open || agents.length === 0) return null;

  const displayAgents = agents;

  const activeCount = displayAgents.filter(
    (a) => a.status === "running" || a.status === "tool",
  ).length;

  return (
    <div
      style={{
        maxHeight: 260,
        overflowY: "auto",
        background: "#111111",
        border: "1px solid rgba(255,255,255,0.08)",
        borderBottom: "none",
        borderRadius: "10px 10px 0 0",
        boxShadow: "0 -16px 40px rgba(0, 0, 0, 0.35)",
        zIndex: 100,
        padding: "6px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 10px 10px",
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.08)" : "none",
          marginBottom: expanded ? 6 : 0,
          color: "var(--text-weaker)",
          fontSize: 11,
        }}
      >
        <span style={{ fontWeight: 500, color: "var(--text-weak)" }}>
          Swarm Activity ({activeCount} active)
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {activeCount === 0 && (
            <button
              onClick={onClearAgents}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-weaker)",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-weaker)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            title={expanded ? "Collapse panel" : "Expand panel"}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {expanded ? (
                <polyline points="6 9 12 15 18 9" />
              ) : (
                <polyline points="18 15 12 9 6 15" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {expanded &&
        displayAgents.map((agent, _idx) => (
          <div
            key={agent.id}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "none",
              borderRadius: 7,
              background: "transparent",
              color: "var(--text-base)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              fontSize: 12,
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontWeight: 500,
                  color: "var(--text-strong)",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    color: statusColors[agent.status] || "#777780",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                    <line x1="6" y1="1" x2="6" y2="4" />
                    <line x1="10" y1="1" x2="10" y2="4" />
                    <line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                </span>
                {agent.role}
              </span>
              <span
                onContextMenu={(e) => {
                  e.preventDefault();
                  const copyText =
                    agent.debugLog ||
                    `[${agent.role}] ${agent.currentTool ? `Tool: ${agent.currentTool} - ` : ""}${agent.lastMessage || ""}`;
                  navigator.clipboard.writeText(copyText);
                }}
                title="Right click to copy details"
                style={{
                  fontSize: 11,
                  color: "var(--text-weaker)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: "context-menu",
                }}
              >
                {agent.currentTool ? (
                  <span
                    style={{
                      fontFamily: "var(--font-family-monospace)",
                      background: "rgba(255,255,255,0.05)",
                      padding: "2px 4px",
                      borderRadius: 4,
                      marginRight: 4,
                    }}
                  >
                    {agent.currentTool}
                  </span>
                ) : (
                  ""
                )}
                {agent.lastMessage}
              </span>
            </div>
          </div>
        ))}
    </div>
  );
}
