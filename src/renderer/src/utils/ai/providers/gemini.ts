import { GoogleGenAI } from "@google/genai";
import { registerProvider } from "./registry";
import type { Message, StreamEvent, ToolDefinition } from "../types";

function convertRole(role: string): string {
  if (role === "assistant") return "model";
  if (role === "system") return "system"; // Usually passed separately
  return "user";
}

function convertMessages(messages: Message[]): any[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      return { role: convertRole(m.role), parts: [{ text: m.content }] };
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
  const ai = new GoogleGenAI({
    apiKey: config.apiKey,
    // Note: The new @google/genai SDK doesn't natively support overriding the baseURL in a trivial way
    // without using custom fetch or advanced options, but defaults to the correct endpoints.
  });

  const systemMessage = messages.find((m) => m.role === "system")?.content;
  const systemInstruction = typeof systemMessage === "string" ? systemMessage : undefined;

  // Format tools for Gemini
  const functionDeclarations = tools?.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? "",
    parameters: t.function.parameters as any,
  }));

  const geminiTools =
    functionDeclarations && functionDeclarations.length > 0
      ? [{ functionDeclarations }]
      : undefined;

  const stream = await ai.models.generateContentStream({
    model: config.model || "gemini-2.5-flash",
    contents: convertMessages(messages),
    config: {
      systemInstruction,
      tools: geminiTools,
    },
  });

  for await (const chunk of stream) {
    if (signal?.aborted) break;

    if (chunk.text) {
      yield { type: "content", text: chunk.text as string };
    }

    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
      for (const call of chunk.functionCalls) {
        yield {
          type: "tool_call_done",
          call: {
            id: crypto.randomUUID(),
            type: "function",
            function: {
              name: call.name || "",
              arguments: JSON.stringify(call.args || {}),
            },
          },
        };
      }
    }
  }

  // Gemini doesn't stream token usage chunk by chunk exactly like OpenAI,
  // but we yield a dummy 'done' to complete the stream.
  yield {
    type: "done",
    finish_reason: "stop",
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

registerProvider({
  id: "google",
  streamCompletion,
  supportsReasoning: () => false, // Set to true if using experimental Gemini 2.0 thinking features
});
