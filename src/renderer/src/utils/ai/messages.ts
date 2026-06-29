import type { ChatMessage } from "../../hooks/agentTypes";
import type { Message } from "./types";
export { compactMessages, shouldCompact } from "./compaction";

export function toAPIMessage(m: ChatMessage): Message {
  const base: Message = { role: m.role, content: m.content };
  if (m.tool_calls && m.tool_calls.length > 0) base.tool_calls = m.tool_calls;
  if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
  return base;
}

export function sanitizeToolHistory(messages: ChatMessage[]): ChatMessage[] {
  const clean: ChatMessage[] = [];
  for (let index = 0; index < messages.length; ) {
    const message = messages[index];
    if (message.role === "tool") {
      index++;
      continue;
    }
    if (message.role !== "assistant" || !message.tool_calls?.length) {
      clean.push(message);
      index++;
      continue;
    }
    let end = index + 1;
    const results: ChatMessage[] = [];
    while (end < messages.length && messages[end].role === "tool") results.push(messages[end++]);
    const expected = new Set(message.tool_calls.map((call) => call.id));
    const complete =
      results.length >= expected.size &&
      results.every((result) => result.tool_call_id && expected.has(result.tool_call_id));
    if (complete) clean.push(message, ...results);
    else if (message.content) clean.push({ ...message, tool_calls: undefined });
    index = end;
  }
  return clean;
}
