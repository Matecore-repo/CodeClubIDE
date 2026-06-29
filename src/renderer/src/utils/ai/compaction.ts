import type { Message } from "./types";
import { encode } from "gpt-tokenizer";
import { maxContext } from "./types";

export interface StableContextSummary {
  decisions: string[];
  files: string[];
  changes: string[];
  errors: string[];
  pending: string[];
}

const KEEP_COUNT = 6;
const summaryCache = new Map<string, StableContextSummary>();

export function shouldCompact(messages: Message[], model: string): boolean {
  return (
    messages.reduce((total, message) => total + encode(message.content).length, 0) >=
    maxContext(model) * 0.5
  );
}

function hasIncompleteToolCalls(messages: Message[]): boolean {
  const expected = new Set<string>();
  const completed = new Set<string>();
  for (const message of messages) {
    message.tool_calls?.forEach((call) => expected.add(call.id));
    if (message.tool_call_id) completed.add(message.tool_call_id);
  }
  return [...expected].some((id) => !completed.has(id));
}

function stableKey(messages: Message[]): string {
  let hash = 2166136261;
  const value = JSON.stringify(messages);
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `${messages.length}:${hash >>> 0}`;
}

function parseSummary(raw: string): StableContextSummary | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Partial<StableContextSummary>;
    const list = (value: unknown) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return {
      decisions: list(parsed.decisions),
      files: list(parsed.files),
      changes: list(parsed.changes),
      errors: list(parsed.errors),
      pending: list(parsed.pending),
    };
  } catch {
    return null;
  }
}

export async function compactMessages(
  priorMsgs: Message[],
  config: { apiKey: string; baseUrl: string; model: string },
  streamCompletion: any,
  force: boolean = false,
): Promise<{ messages: Message[]; summary: StableContextSummary } | null> {
  const systemMsg = priorMsgs.find((message) => message.role === "system");
  const otherMsgs = priorMsgs.filter((message) => message.role !== "system");
  let keep = force ? 2 : KEEP_COUNT;
  if (force) {
    const lastUserIdx = otherMsgs.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx !== -1) keep = otherMsgs.length - lastUserIdx;
  }

  if (otherMsgs.length <= keep) return null;
  if (!force && hasIncompleteToolCalls(otherMsgs)) return null;

  const messagesToCompact = otherMsgs.slice(0, -keep);
  let messagesToKeep = otherMsgs.slice(-keep);
  while (messagesToKeep[0]?.role === "tool") messagesToKeep = messagesToKeep.slice(1);
  if (
    !force &&
    (hasIncompleteToolCalls(messagesToCompact) || hasIncompleteToolCalls(messagesToKeep))
  )
    return null;

  const key = stableKey(messagesToCompact);
  let summary = summaryCache.get(key);
  if (!summary) {
    try {
      const prompt = `Summarize this completed coding conversation as strict JSON with string arrays: {"decisions":[],"files":[],"changes":[],"errors":[],"pending":[]}. Preserve exact paths, commands, decisions, unresolved errors and pending work. No markdown.\n\n${messagesToCompact.map((m) => `${m.role}: ${m.content}`).join("\n\n")}`;
      let raw = "";
      for await (const event of streamCompletion([{ role: "user", content: prompt }], config)) {
        if (event.type === "content") raw += event.text;
      }
      summary = parseSummary(raw) ?? undefined;
      if (!summary) return null;
      summaryCache.set(key, summary);
    } catch {
      return null;
    }
  }

  const messages: Message[] = [];
  if (systemMsg) messages.push(systemMsg);
  messages.push({ role: "system", content: `[STABLE CONTEXT]\n${JSON.stringify(summary)}` });
  messages.push(...messagesToKeep);
  return { messages, summary };
}
