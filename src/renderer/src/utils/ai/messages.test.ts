import { describe, expect, it } from "vite-plus/test";
import type { ChatMessage } from "../../hooks/agentTypes";
import { sanitizeToolHistory } from "./messages";

const call = {
  id: "call-1",
  type: "function" as const,
  function: { name: "read", arguments: "{}" },
};

describe("sanitizeToolHistory", () => {
  it("keeps complete assistant/tool pairs", () => {
    const messages: ChatMessage[] = [
      { id: "a", role: "assistant", content: "", tool_calls: [call] },
      { id: "t", role: "tool", content: "ok", tool_call_id: call.id },
    ];
    expect(sanitizeToolHistory(messages)).toEqual(messages);
  });

  it("drops orphan tool results", () => {
    const messages: ChatMessage[] = [
      { id: "t", role: "tool", content: "orphan", tool_call_id: call.id },
    ];
    expect(sanitizeToolHistory(messages)).toEqual([]);
  });

  it("removes incomplete tool calls but preserves assistant text", () => {
    const messages: ChatMessage[] = [
      { id: "a", role: "assistant", content: "working", tool_calls: [call] },
    ];
    expect(sanitizeToolHistory(messages)).toEqual([
      { id: "a", role: "assistant", content: "working", tool_calls: undefined },
    ]);
  });
});
