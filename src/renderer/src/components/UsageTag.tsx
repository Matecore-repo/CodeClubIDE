import type { ModelInfo } from "../utils/ai";
import { maxContext } from "../utils/ai";
import { encode } from "gpt-tokenizer";

export function UsageTag({
  usage,
  model,
  models,
  content,
  sandbox,
}: {
  usage?: any;
  model?: string;
  models?: ModelInfo[];
  content?: string;
  sandbox?: boolean;
}) {
  const ctx = model ? maxContext(model, models) : 128000;
  const toolsCount = usage?.active_tools;
  const sandboxLabel = sandbox ? " · sandbox" : "";

  if (!usage) {
    const estimated = content ? encode(content).length : 0;
    if (!estimated) {
      return (
        <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.4, color: "var(--text-weaker)" }}>
          {toolsCount !== undefined ? `${toolsCount} tools` : "tools n/a"}
          {sandboxLabel}
        </span>
      );
    }
    const pct = (estimated / ctx) * 100;
    return (
      <span
        style={{
          fontSize: 10,
          marginLeft: 6,
          opacity: 0.4,
          color: "var(--text-weaker)",
          cursor: "help",
        }}
        title="Estimated (provider did not report usage)"
      >
        ~{estimated} tokens · ~{pct.toFixed(1)}% used
        {toolsCount !== undefined ? ` · ${toolsCount} tools` : ""}
        {sandboxLabel}
      </span>
    );
  }
  const pct = (usage.total_tokens / ctx) * 100;
  const pctColor = pct > 90 ? "#f59e0b" : "var(--text-weaker)";
  const pctOpacity = pct > 90 ? 1 : 0.7;
  return (
    <span
      style={{
        fontSize: 10,
        marginLeft: 6,
        color: pctColor,
        opacity: pctOpacity,
      }}
    >
      {usage.total_tokens} tokens · {pct.toFixed(1)}% ctx
      {usage.estimated_cost_usd !== undefined ? ` · ~$${usage.estimated_cost_usd.toFixed(4)}` : ""}
      {usage.time_to_first_token_ms !== undefined
        ? ` · TTFT ${usage.time_to_first_token_ms}ms`
        : ""}
      {usage.latency_ms !== undefined ? ` · ${usage.latency_ms}ms` : ""}
      {usage.peak_memory_mb !== undefined ? ` · ${usage.peak_memory_mb}MB` : ""}
      {usage.cached_tokens ? ` · ${usage.cached_tokens} cached` : ""}
      {usage.reasoning_tokens ? ` · ${usage.reasoning_tokens} reasoning` : ""}
      {toolsCount !== undefined ? ` · ${toolsCount} tools` : ""}
      {sandboxLabel}
    </span>
  );
}
