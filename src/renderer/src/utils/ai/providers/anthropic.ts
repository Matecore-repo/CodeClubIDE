import Anthropic from "@anthropic-ai/sdk";
import { registerProvider } from "./registry";
import type { Message, StreamEvent, ToolDefinition } from "../types";

function convertMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const role: "user" | "assistant" = m.role === "assistant" ? "assistant" : "user";
      return { role, content: m.content };
    });
}

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
  const anthropic = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true, // Bypass browser restriction in Electron renderer
  });

  const systemMessage = messages.find((m) => m.role === "system")?.content;
  const system = typeof systemMessage === "string" ? systemMessage : undefined;

  // Format tools if provided
  const anthropicTools: Anthropic.Tool[] | undefined = tools?.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? "",
    input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
  }));

  const stream = await anthropic.messages.create(
    {
      model: config.model || "claude-3-7-sonnet-20250219",
      messages: convertMessages(messages),
      system,
      tools: anthropicTools,
      max_tokens: 8192,
      stream: true,
    },
    { signal },
  );

  let currentToolCall: any = null;

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      yield { type: "content", text: chunk.delta.text };
    } else if (chunk.type === "content_block_start" && chunk.content_block.type === "tool_use") {
      currentToolCall = {
        id: chunk.content_block.id,
        type: "function",
        function: { name: chunk.content_block.name, arguments: "" },
      };
    } else if (chunk.type === "content_block_delta" && chunk.delta.type === "input_json_delta") {
      if (currentToolCall) {
        currentToolCall.function.arguments += chunk.delta.partial_json;
      }
    } else if (chunk.type === "content_block_stop") {
      if (currentToolCall) {
        yield { type: "tool_call_done", call: currentToolCall };
        currentToolCall = null;
      }
    } else if (chunk.type === "message_stop") {
      const msg = (chunk as any).message;
      yield {
        type: "done",
        finish_reason: "stop",
        usage: {
          prompt_tokens: msg?.usage?.input_tokens ?? 0,
          completion_tokens: msg?.usage?.output_tokens ?? 0,
          total_tokens: (msg?.usage?.input_tokens ?? 0) + (msg?.usage?.output_tokens ?? 0),
        },
      };
    }
  }
}

registerProvider({
  id: "anthropic",
  streamCompletion,
  supportsReasoning: (model) => !!model?.id.includes("3-7"), // claude-3-7 supports extended thinking if enabled, but disabled for simplicity here unless implemented
});
