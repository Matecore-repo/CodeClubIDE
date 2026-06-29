import { streamChatCompletion } from "./chat";
import type { Message, StreamEvent, ToolDefinition } from "./types";
import { formatTools, formatMessages } from "./tools/opencode";

export async function* streamCompletion(
  messages: Message[],
  config: {
    apiKey: string;
    baseUrl: string;
    model: string;
    reasoning_effort?: "low" | "medium" | "high";
  },
  tools?: ToolDefinition[],
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  yield* streamChatCompletion(
    formatMessages(messages),
    config,
    formatTools(tools) as ToolDefinition[],
    signal,
  );
}
