import { useState, useEffect, useCallback } from "react";
import type { ModelInfo } from "../utils/ai";
import type { TurnSummary } from "../hooks/useChat";

import { renderContent, extractThinking } from "../utils/markdown";

// Default thinking frames
const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Per-tool spinner configs: distinct braille patterns + label
export const TOOL_SPINNERS: Record<string, { frames: string[]; label: string }> = {
  read: { frames: ["⠦", "⠇", "⠏", "⠋", "⠙", "⠹"], label: "Reading" },
  readNode: { frames: ["⠦", "⠇", "⠏", "⠋", "⠙", "⠹"], label: "Reading" },
  read_file: { frames: ["⠦", "⠇", "⠏", "⠋", "⠙", "⠹"], label: "Reading" },
  write: { frames: ["⣀", "⣄", "⣆", "⣇", "⣧", "⣷", "⣿", "⣷", "⣧", "⣇"], label: "Writing" },
  writeNode: { frames: ["⣀", "⣄", "⣆", "⣇", "⣧", "⣷", "⣿", "⣷", "⣧", "⣇"], label: "Writing" },
  write_file: { frames: ["⣀", "⣄", "⣆", "⣇", "⣧", "⣷", "⣿", "⣷", "⣧", "⣇"], label: "Writing" },
  edit: { frames: ["⠿", "⠾", "⠼", "⠸", "⠼", "⠾"], label: "Editing" },
  editNode: { frames: ["⠿", "⠾", "⠼", "⠸", "⠼", "⠾"], label: "Editing" },
  edit_file: { frames: ["⠿", "⠾", "⠼", "⠸", "⠼", "⠾"], label: "Editing" },
  delete: { frames: ["⠤", "⠠", "⠄", "⠂", "⠐", "⠈"], label: "Deleting" },
  move_node: { frames: ["⠦", "⠴", "⠲", "⠰", "⠠", "⠄"], label: "Moving" },
  run_terminal: { frames: ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈"], label: "Running" },
  node_workflow: { frames: ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈"], label: "Running" },
  grep: { frames: ["⠶", "⠦", "⠖", "⠲", "⠶"], label: "Searching" },
  glob: { frames: ["⠶", "⠦", "⠖", "⠲", "⠶"], label: "Scanning" },
  topo: { frames: ["⠶", "⠦", "⠖", "⠲", "⠶"], label: "Mapping" },
  fetch: { frames: ["⠾", "⠽", "⠻", "⠷", "⠾"], label: "Fetching" },
  memory_set: { frames: ["⠤", "⠠", "⠤", "⠄"], label: "Saving" },
  memory_get: { frames: ["⠤", "⠠", "⠤", "⠄"], label: "Recalling" },
  indexFile: { frames: ["⡈", "⢁", "⠂", "⠐"], label: "Indexing" },
};

TOOL_SPINNERS.run_tool_chain = { frames: TOOL_SPINNERS.run_terminal.frames, label: "Chaining" };
TOOL_SPINNERS.terminal = { frames: TOOL_SPINNERS.run_terminal.frames, label: "Running" };
TOOL_SPINNERS.search = { frames: TOOL_SPINNERS.grep.frames, label: "Searching" };
TOOL_SPINNERS.subagents = { frames: TOOL_SPINNERS.run_terminal.frames, label: "Delegating" };
TOOL_SPINNERS.tool_chain = { frames: TOOL_SPINNERS.run_terminal.frames, label: "Chaining" };

function Spinner({ label, toolName }: { label: string; toolName?: string }) {
  const [idx, setIdx] = useState(0);
  const [activeLabel, setActiveLabel] = useState(label);

  useEffect(() => {
    if (toolName && TOOL_SPINNERS[toolName]?.label) {
      setActiveLabel(TOOL_SPINNERS[toolName].label + "...");
      const timer = setTimeout(() => {
        setActiveLabel(label);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setActiveLabel(label);
    }
  }, [toolName, label]);

  const cfg = toolName ? TOOL_SPINNERS[toolName] : undefined;
  const frames = cfg?.frames ?? spinnerFrames;

  useEffect(() => {
    setIdx(0);
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), 80);
    return () => clearInterval(t);
  }, [frames]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: "var(--text-weaker)",
        fontSize: "var(--font-size-base)",
        padding: "6px 0",
        lineHeight: "var(--line-height-large)",
      }}
    >
      <span
        style={{
          fontSize: 16,
          lineHeight: 1,
          fontFamily: "monospace",
          display: "inline-block",
          width: 14,
        }}
      >
        {frames[idx]}
      </span>
      <span>{activeLabel}</span>
    </div>
  );
}

function ThinkingCursor() {
  const frames = [
    "\u280b",
    "\u2819",
    "\u2839",
    "\u2838",
    "\u283c",
    "\u2834",
    "\u2826",
    "\u2827",
    "\u2807",
    "\u280f",
  ];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % frames.length), 80);
    return () => clearInterval(timer);
  }, []);
  return (
    <span
      aria-label="Thinking"
      style={{ color: "var(--text-weaker)", marginLeft: 5, fontFamily: "monospace" }}
    >
      {frames[index]}
    </span>
  );
}

export function Message({
  role,
  content,
  color,
  userName,
  onRegenerate,
  onRestoreCheckpoint,
  loading,
  usage: _usage,
  model: _model,
  models: _models,
  sandbox: _sandbox,
  turnSummary,
  toolName,
}: {
  role: string;
  content: string;
  color?: string;
  userName?: string;
  onRegenerate?: () => void;
  onRestoreCheckpoint?: () => void;
  loading?: boolean;
  usage?: any;
  model?: string;
  models?: ModelInfo[];
  sandbox?: boolean;
  turnSummary?: TurnSummary;
  toolName?: string;
}) {
  const isUser = role === "user";
  const isTool = role === "tool";
  const [copied, setCopied] = useState(false);
  const doCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [content]);

  if (isTool) {
    const isRunning = content === "Tool running..." || content === "Subagent starting...";
    return (
      <div
        style={{
          margin: "2px 0",
          padding: "2px 0",
          fontSize: "var(--font-size-small)",
          display: "flex",
          flexDirection: "column" as const,
        }}
      >
        <details style={{ cursor: "pointer" }}>
          <summary
            style={{
              color: "var(--text-weaker)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              background: "var(--surface-inset-base)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-weaker-base)",
              userSelect: "none",
              outline: "none",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: isRunning ? "var(--text-accent)" : "var(--text-success)" }}
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span style={{ fontWeight: 500 }}>Tool:</span>
            <code
              style={{ fontFamily: "var(--font-family-monospace)", color: "var(--text-strong)" }}
            >
              {toolName || "execute"}
            </code>
            <span
              style={{
                fontSize: "10px",
                color: isRunning ? "var(--text-accent-base)" : "var(--text-weaker)",
              }}
            >
              ({isRunning ? "Running..." : "Completed"})
            </span>
          </summary>
          <div
            style={{
              marginTop: 4,
              padding: "8px 12px",
              background: "var(--surface-inset-base)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-weaker-base)",
              fontFamily: "var(--font-family-monospace)",
              fontSize: "11px",
              maxHeight: "200px",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              color: "var(--text-weak)",
            }}
          >
            {content}
          </div>
        </details>
      </div>
    );
  }

  const { thinking, mainContent } = extractThinking(content || "");
  const cleanContent = mainContent
    ? mainContent.replace(/<file_reference\s+path=["'][^"']*["']\s*\/>/gi, "").trim()
    : "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column" as const,
        gap: 2,
        padding: "6px 0",
      }}
    >
      <div
        style={{
          fontSize: "var(--font-size-small)",
          fontWeight: 500,
          color: isUser && color ? color : "var(--text-weaker)",
          letterSpacing: "0.02em",
        }}
      >
        {isUser ? userName || "You" : "Assistant"}
      </div>

      {!isUser && thinking !== null && (
        <details
          style={{
            fontSize: "12px",
            color: "var(--text-weaker)",
            borderLeft: "2px solid var(--border-weaker-base)",
            paddingLeft: "10px",
            margin: "6px 0",
          }}
          open={loading || undefined}
        >
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 500,
              userSelect: "none",
              outline: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.7 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Thought Process</span>
          </summary>
          <div
            style={{
              marginTop: "4px",
              lineHeight: "1.4",
              color: "var(--text-weak)",
              fontStyle: "italic",
            }}
          >
            {thinking.trim() || "Pensando..."}
          </div>
        </details>
      )}

      <div
        style={{
          fontSize: "var(--font-size-base)",
          lineHeight: "var(--line-height-large)",
          color: "var(--text-base)",
          whiteSpace: "pre-wrap" as const,
          wordBreak: "break-word" as const,
          padding: "6px 0",
        }}
      >
        {cleanContent ? (
          <>
            {renderContent(cleanContent)}
            {loading && <ThinkingCursor />}
          </>
        ) : loading ? (
          <Spinner label="Agent is thinking and drinking a coffee..." toolName={toolName} />
        ) : null}
      </div>
      {isUser && content && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button
            onClick={doCopy}
            title="Copy message"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: copied ? "var(--text-success)" : "var(--text-weaker)",
              padding: 2,
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
              transition: "color 0.2s",
            }}
          >
            {copied ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <button
            disabled={!onRestoreCheckpoint}
            onClick={() => {
              if (!onRestoreCheckpoint) return;
              if (!confirm("Restore chat and files to this checkpoint?")) return;
              void onRestoreCheckpoint();
            }}
            title={
              onRestoreCheckpoint
                ? "Restore chat and files to this checkpoint"
                : "No checkpoint available for this message"
            }
            style={{
              border: "none",
              background: "transparent",
              cursor: onRestoreCheckpoint ? "pointer" : "not-allowed",
              color: onRestoreCheckpoint ? "var(--text-weaker)" : "rgba(255, 255, 255, 0.18)",
              opacity: onRestoreCheckpoint ? 1 : 0.4,
              padding: 2,
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
              transition: "opacity 0.2s, color 0.2s",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
      )}
      {!isUser && turnSummary && (
        <details style={{ fontSize: "var(--font-size-small)", marginTop: 4 }}>
          <summary
            style={{
              cursor: "pointer",
              color: "var(--text-weaker)",
              padding: "2px 0",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            Turn Summary
          </summary>
          <div
            style={{
              background: "var(--surface-inset-base)",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              margin: "4px 0 8px 0",
              color: "var(--text-weak)",
              border: "1px solid var(--border-weaker-base)",
            }}
          >
            <div style={{ marginBottom: 4 }}>
              <strong>Tools Executed ({turnSummary.toolNames.length}):</strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, marginBottom: 8, color: "var(--text-base)" }}>
              {(Array.from(new Set(turnSummary.toolNames)) as string[]).map((name) => (
                <li key={name}>
                  {name} (x{turnSummary.toolNames.filter((n: string) => n === name).length})
                </li>
              ))}
            </ul>
            <div>
              <strong>Data Read:</strong> ~{(turnSummary.totalCharsRead / 1024).toFixed(1)} KB (
              {turnSummary.totalCharsRead} chars)
            </div>
          </div>
        </details>
      )}
      {!isUser && content && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button
            onClick={doCopy}
            title="Copy"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: copied ? "var(--text-strong)" : "var(--text-weaker)",
              padding: 2,
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
            }}
          >
            {copied ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <button
            onClick={onRegenerate}
            title="Regenerate"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-weaker)",
              padding: 2,
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
