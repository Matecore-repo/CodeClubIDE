import { registerProvider } from "./registry";
import { streamChatCompletion } from "../chat";
import type { Message, StreamEvent, ToolDefinition } from "../types";

export async function* streamCompletion(
  messages: Message[],
  config: {
    apiKey: string;
    baseUrl: string;
    model: string;
    reasoning_effort?: "low" | "medium" | "high";
    endpoint?: string;
  },
  tools?: ToolDefinition[],
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  // Use the IPC proxy-based stream from chat.ts to bypass CORS in LM Studio
  yield* streamChatCompletion(messages, config, tools, signal);
}

registerProvider({
  id: "lmstudio",
  streamCompletion,
  supportsReasoning: () => false,
});
