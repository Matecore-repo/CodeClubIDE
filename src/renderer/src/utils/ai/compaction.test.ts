import { describe, expect, it, vi } from "vite-plus/test";
import type { Message, StreamEvent } from "./types";
import { compactMessages } from "./compaction";

const config = { apiKey: "test", baseUrl: "https://example.com", model: "gpt-4o" };

async function* summaryStream(): AsyncGenerator<StreamEvent> {
  yield {
    type: "content",
    text: JSON.stringify({
      decisions: ["Use dynamic tools"],
      files: ["src/app.ts"],
      changes: ["Added selector"],
      errors: [],
      pending: ["Run build"],
    }),
  };
  yield { type: "done", finish_reason: "stop" };
}

describe("compactMessages", () => {
  it("preserves a structured summary and the last six messages", async () => {
    const messages: Message[] = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: `message ${index}`,
    }));
    const result = await compactMessages(messages, config, summaryStream);
    expect(result?.summary.files).toEqual(["src/app.ts"]);
    expect(result?.messages).toHaveLength(7);
    expect(result?.messages[0].content).toContain("[STABLE CONTEXT]");
  });

  it("reuses the summary for an unchanged compacted prefix", async () => {
    const stream = vi.fn(summaryStream);
    const messages: Message[] = Array.from({ length: 9 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: `cached ${index}`,
    }));
    await compactMessages(messages, config, stream);
    await compactMessages(messages, config, stream);
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it("does not compact incomplete tool calls", async () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: "",
        tool_calls: [
          { id: "pending", type: "function", function: { name: "read", arguments: "{}" } },
        ],
      },
      ...Array.from({ length: 7 }, (_, index) => ({
        role: "user" as const,
        content: `message ${index}`,
      })),
    ];
    expect(await compactMessages(messages, config, summaryStream)).toBeNull();
  });
});
