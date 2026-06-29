import { useState, useEffect } from "react";
import type { ToolCall } from "../utils/ai";
import type { ChatMessage } from "../hooks/useChat";
import { TOOL_SPINNERS } from "./ChatMessage";

function truncateArgs(args: string, max = 60): string {
  try {
    const parsed = JSON.parse(args);
    const entries = Object.entries(parsed).map(([k, v]) => {
      const str = typeof v === "string" ? v : JSON.stringify(v);
      return str.length > 40 ? `${k}: "${str.slice(0, 40)}..."` : `${k}: "${str}"`;
    });
    const joined = entries.join(", ");
    return joined.length > max ? joined.slice(0, max) + "..." : joined;
  } catch {
    return args.length > max ? args.slice(0, max) + "..." : args;
  }
}

function ToolCallMessage({ toolCalls, content }: { toolCalls: ToolCall[]; content: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 0" }}>
      <div
        style={{
          fontSize: "var(--font-size-small)",
          color: "var(--text-weaker)",
          fontWeight: 500,
          display: "flex",
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
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        Using tools
      </div>
      {content && (
        <div
          style={{ color: "var(--text-weak)", fontSize: "var(--font-size-small)", marginBottom: 4 }}
        >
          {content}
        </div>
      )}
      {toolCalls.map((tc, i) => (
        <details key={i} style={{ fontSize: "var(--font-size-small)" }}>
          <summary style={{ cursor: "pointer", color: "var(--text-base)", padding: "2px 0" }}>
            <span style={{ color: "var(--text-weak)" }}>{tc.function.name}</span>(
            {truncateArgs(tc.function.arguments)})
          </summary>
          <pre
            style={{
              background: "var(--surface-inset-base)",
              padding: 8,
              borderRadius: "var(--radius-sm)",
              margin: "4px 0",
              overflow: "auto",
              fontSize: "var(--font-size-small)",
              maxHeight: 200,
            }}
          >
            {(() => {
              try {
                return JSON.stringify(JSON.parse(tc.function.arguments), null, 2);
              } catch {
                return tc.function.arguments;
              }
            })()}
          </pre>
        </details>
      ))}
    </div>
  );
}

function ToolResultMessage({
  content,
  toolName,
  pending,
}: {
  content: string;
  toolName?: string;
  pending?: boolean;
}) {
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  const isLiveSubagentStatus = content.startsWith("Subagent ") && !content.includes("\n");

  const cfg = toolName ? TOOL_SPINNERS[toolName] : null;
  const frames = cfg?.frames ?? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const label = cfg?.label ?? "Working";

  useEffect(() => {
    if (!pending && content) return;
    const t = setInterval(() => setSpinnerIdx((i) => (i + 1) % frames.length), 80);
    return () => clearInterval(t);
  }, [pending, content, frames]);

  if (pending || (!content && !isLiveSubagentStatus)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 0" }}>
        <div
          style={{
            fontSize: "var(--font-size-small)",
            color: "var(--text-weaker)",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1, fontFamily: "monospace", width: 14 }}>
            {frames[spinnerIdx]}
          </span>
          <span>
            {label} ({toolName || "tool"})
          </span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 0" }}>
      <div
        style={{
          fontSize: "var(--font-size-small)",
          color: "var(--text-weaker)",
          fontWeight: 500,
          display: "flex",
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
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        Tool result
      </div>
      {isLiveSubagentStatus ? (
        <div style={{ color: "var(--text-weak)", padding: "2px 0" }}>{content}</div>
      ) : (
        <details style={{ fontSize: "var(--font-size-small)" }}>
          <summary style={{ cursor: "pointer", color: "var(--text-weak)" }}>
            Show result ({content.length} chars)
          </summary>
          <pre
            style={{
              background: "var(--surface-inset-base)",
              padding: 8,
              borderRadius: "var(--radius-sm)",
              margin: "4px 0",
              overflow: "auto",
              fontSize: "var(--font-size-small)",
              maxHeight: 300,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {content}
          </pre>
        </details>
      )}
    </div>
  );
}

function formatCharCount(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(count < 10000 ? 1 : 0)}k`;
}

const ACTIVITY_FRAMES = [
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

function ActivityIcon({ active, toolName }: { active: boolean; toolName?: string }) {
  const frames = (toolName && TOOL_SPINNERS[toolName]?.frames) || ACTIVITY_FRAMES;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % frames.length), 80);
    return () => clearInterval(timer);
  }, [active, frames]);
  if (active)
    return (
      <span
        aria-label="Agent active"
        style={{ width: 12, fontFamily: "monospace", fontSize: 14, lineHeight: 1 }}
      >
        {frames[index]}
      </span>
    );
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.8 }}
    >
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

export function ToolActivitySummary({
  messages,
  showProgress,
}: {
  messages: ChatMessage[];
  showProgress: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = showProgress || messages.some((m) => m.role === "tool" && m.pending);
  const [activeLabel, setActiveLabel] = useState("Agent activity");

  useEffect(() => {
    if (!isActive) {
      setActiveLabel("Agent activity");
      return;
    }
    const lastToolName = messages.findLast((m) => m.tool_calls?.length)?.tool_calls?.at(-1)
      ?.function.name;
    if (lastToolName) {
      const label = TOOL_SPINNERS[lastToolName]?.label ?? `Using ${lastToolName}`;
      setActiveLabel(label + "...");
      const timer = setTimeout(() => {
        setActiveLabel("Agent is thinking and drinking a coffee...");
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setActiveLabel("Agent is thinking and drinking a coffee...");
    }
  }, [messages, isActive]);

  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    setIsOpen(e.currentTarget.open);
  };

  const toolCounts = new Map<string, number>();
  let toolCallCount = 0;
  let resultCount = 0;
  let resultChars = 0;

  for (const message of messages) {
    for (const call of message.tool_calls ?? []) {
      const name = call.function.name;
      toolCallCount++;
      toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1);
    }
    if (message.role === "tool") {
      resultCount++;
      resultChars += message.content.length;
    }
  }

  const tools = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => `${name} x${count}`)
    .join(", ");
  const pendingTool = messages.findLast((message) => message.role === "tool" && message.pending);
  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const operations: Array<{ name: string; args: string; result?: string; pending?: boolean }> =
      [];
    for (const msg of messages) {
      if (msg.tool_calls) {
        for (const call of msg.tool_calls) {
          let args = call.function.arguments;
          try {
            args = JSON.stringify(JSON.parse(call.function.arguments), null, 2);
          } catch {}
          operations.push({ name: call.function.name, args });
        }
      }
      if (msg.role === "tool") {
        const operation = operations.find((item) => item.result === undefined);
        if (operation) {
          operation.result = msg.content;
          operation.pending = msg.pending;
        }
      }
    }
    const blocks = operations.map((operation, index) => {
      // eslint-disable-next-line no-control-regex
      const raw = operation.result?.replace(/\u001b\[[0-9;]*m/g, "").trim() || "";
      let result = raw;
      try {
        result = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {}
      if (result.length > 2000)
        result = `${result.slice(0, 2000)}\n… truncated (${result.length - 2000} chars)`;
      const failed = /^(error|failed)|"ok"\s*:\s*false/i.test(result);
      return `[${index + 1}] ${operation.name} — ${operation.pending ? "RUNNING" : failed ? "ERROR" : "OK"}\nargs:\n${operation.args || "{}"}\nresult:\n${operation.pending ? "Running…" : result || "(empty)"}`;
    });

    const summaryText = `codeclub Tool Trace\ntools: ${tools || "none"}\n\n${blocks.join("\n\n")}`;

    navigator.clipboard.writeText(summaryText);
  };

  return (
    <details
      open={isOpen}
      onToggle={handleToggle}
      style={{ margin: "16px 0 8px 0", padding: "4px 0", fontSize: "var(--font-size-small)" }}
    >
      <summary
        onContextMenu={copyToClipboard}
        title="Right-click to copy debug summary"
        style={{
          cursor: "pointer",
          color: "var(--text-weak)",
          fontWeight: 500,
          userSelect: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          listStyle: "none",
        }}
      >
        <ActivityIcon active={isActive} toolName={pendingTool?.toolName} />
        <span>{activeLabel}</span>
        {tools && <span style={{ color: "var(--text-weaker)", fontWeight: 400 }}> · {tools}</span>}
      </summary>
      <div
        style={{
          borderLeft: "1px solid var(--border-weak-base)",
          margin: "6px 0 2px 5px",
          paddingLeft: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "var(--text-weaker)",
            marginBottom: 6,
            opacity: 0.8,
            userSelect: "none",
          }}
        >
          {toolCallCount} tools · {resultCount} resultados · {formatCharCount(resultChars)} chars
        </div>
        {messages.map((message) =>
          message.role === "tool" ? (
            <ToolResultMessage
              key={message.id}
              content={message.content}
              toolName={message.toolName}
              pending={message.pending}
            />
          ) : message.tool_calls?.length ? (
            <ToolCallMessage
              key={message.id}
              toolCalls={message.tool_calls}
              content={message.content}
            />
          ) : showProgress ? (
            <div key={message.id} style={{ color: "var(--text-weaker)", padding: "4px 0" }}>
              {message.content}
            </div>
          ) : null,
        )}
      </div>
    </details>
  );
}

type DisplayMessage =
  | { type: "message"; message: ChatMessage }
  | { type: "tool-activity"; id: string; messages: ChatMessage[] };

export function groupToolActivity(messages: ChatMessage[]): DisplayMessage[] {
  const grouped: DisplayMessage[] = [];

  for (let i = 0; i < messages.length; ) {
    const message = messages[i];

    if (message.role === "assistant" && message.content && !message.tool_calls?.length) {
      grouped.push({ type: "message", message });
    } else if (message.role !== "tool" && message.role !== "assistant") {
      grouped.push({ type: "message", message });
      i++;
      continue;
    }

    let scan = i;
    let lastActivityIndex = -1;
    const activityMessages: ChatMessage[] = [];

    while (scan < messages.length) {
      const candidate = messages[scan];
      if (candidate.role === "system" || candidate.role === "user") break;

      if (candidate.role === "tool" || candidate.tool_calls?.length) {
        activityMessages.push(candidate);
        lastActivityIndex = scan;
      } else if (candidate.role === "assistant" && !candidate.tool_calls?.length) {
        break;
      }
      scan++;
    }

    if (activityMessages.length > 0) {
      grouped.push({
        type: "tool-activity",
        id: "tool-act-" + activityMessages[0].id,
        messages: activityMessages,
      });
      i = lastActivityIndex + 1;
    } else {
      i++;
    }
  }

  return grouped;
}
