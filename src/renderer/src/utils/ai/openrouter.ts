import OpenAI from "openai";
import type { Message, StreamEvent, ToolDefinition, UsageInfo } from "./types";

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
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      "HTTP-Referer": "https://codeclub.app",
      "X-Title": "codeclub",
    },
  });

  const { applyPromptCaching } = require("./caching");
  const { processedMessages, headers } = applyPromptCaching(messages, config.model);

  const stream = await client.chat.completions.create(
    {
      model: config.model,
      messages: processedMessages as any,
      stream: true,
      tools: tools?.map((t) => ({ type: "function" as const, function: t.function })),
      ...(config.reasoning_effort ? { reasoning_effort: config.reasoning_effort } : {}),
    },
    { signal, headers: headers as any },
  );

  const toolCallAccum: Record<number, { id?: string; name?: string; args: string }> = {};
  let usage: UsageInfo | undefined;

  for await (const chunk of stream) {
    if (chunk.usage) {
      usage = {
        prompt_tokens: chunk.usage.prompt_tokens ?? 0,
        completion_tokens: chunk.usage.completion_tokens ?? 0,
        total_tokens: chunk.usage.total_tokens ?? 0,
      };
    }

    const choice = chunk.choices?.[0];
    if (!choice) continue;

    const { delta, finish_reason } = choice;

    if (delta?.content) {
      yield { type: "content", text: delta.content };
    }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!toolCallAccum[idx]) toolCallAccum[idx] = { args: "" };
        if (tc.id) toolCallAccum[idx].id = tc.id;
        if (tc.function?.name) toolCallAccum[idx].name = tc.function.name;
        if (tc.function?.arguments) toolCallAccum[idx].args += tc.function.arguments;
      }
    }

    if (finish_reason) {
      if (finish_reason === "tool_calls") {
        for (const idx of Object.keys(toolCallAccum).map(Number).sort()) {
          const acc = toolCallAccum[idx];
          if (acc.id && acc.name) {
            yield {
              type: "tool_call_done",
              call: {
                id: acc.id,
                type: "function",
                function: { name: acc.name, arguments: acc.args },
              },
            };
          }
        }
        yield { type: "done", finish_reason: "tool_calls", usage };
      } else if (finish_reason === "stop") {
        yield { type: "done", finish_reason: "stop", usage };
      } else {
        yield {
          type: "done",
          finish_reason: finish_reason as "stop" | "tool_calls" | "length" | "error",
          usage,
        };
      }
    }
  }
}
