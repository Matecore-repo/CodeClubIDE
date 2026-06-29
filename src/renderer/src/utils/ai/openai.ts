import OpenAI from "openai";
import type { Message, StreamEvent, ToolDefinition, UsageInfo } from "./types";
import { toResponsesInput } from "./tools/responses";
import { applyPromptCaching } from "./caching";

const OPENAI_PRICING: Record<string, { input: number; cachedInput?: number; output: number }> = {
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10 },
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
  "gpt-4.1": { input: 2, cachedInput: 0.5, output: 8 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, cachedInput: 0.025, output: 0.4 },
};

function openAICost(model: string, usage: UsageInfo): number | undefined {
  const key = Object.keys(OPENAI_PRICING)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => model === candidate || model.startsWith(`${candidate}-`));
  if (!key) return undefined;
  const price = OPENAI_PRICING[key];
  const cached = Math.min(usage.cached_tokens ?? 0, usage.prompt_tokens);
  const regularInput = usage.prompt_tokens - cached;
  return (
    (regularInput * price.input +
      cached * (price.cachedInput ?? price.input) +
      usage.completion_tokens * price.output) /
    1_000_000
  );
}

function finishOpenAIUsage(
  usage: UsageInfo | undefined,
  model: string,
  startedAt: number,
  firstTokenAt?: number,
): UsageInfo | undefined {
  if (!usage) return undefined;
  usage.latency_ms = Math.round(performance.now() - startedAt);
  usage.time_to_first_token_ms = Math.round((firstTokenAt ?? performance.now()) - startedAt);
  usage.estimated_cost_usd = openAICost(model, usage);
  return usage;
}

async function* handleChatCompletion(
  client: OpenAI,
  messages: Message[],
  config: { model: string; reasoning_effort?: "low" | "medium" | "high" },
  tools?: ToolDefinition[],
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const startedAt = performance.now();
  let firstTokenAt: number | undefined;

  const { processedMessages, headers } = applyPromptCaching(messages, config.model);

  const stream = await client.chat.completions.create(
    {
      model: config.model,
      messages: processedMessages as any,
      stream: true,
      stream_options: { include_usage: true },
      tools: tools?.map((t) => ({ type: "function" as const, function: t.function })),
      ...(config.reasoning_effort ? { reasoning_effort: config.reasoning_effort } : {}),
    },
    {
      signal,
      headers,
    } as any,
  );

  const toolCallAccum: Record<number, { id?: string; name?: string; args: string }> = {};
  let usage: UsageInfo | undefined;
  let finalReason: "stop" | "tool_calls" | "length" | "error" | undefined;

  for await (const chunk of stream) {
    if (chunk.usage) {
      usage = {
        prompt_tokens: chunk.usage.prompt_tokens ?? 0,
        completion_tokens: chunk.usage.completion_tokens ?? 0,
        total_tokens: chunk.usage.total_tokens ?? 0,
        cached_tokens: chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
        reasoning_tokens: chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0,
      };
    }

    const choice = chunk.choices?.[0];
    if (!choice) continue;

    const { delta, finish_reason } = choice;

    if (delta?.content) {
      firstTokenAt ??= performance.now();
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
      finalReason = finish_reason as "stop" | "tool_calls" | "length" | "error";
    }
  }

  if (finalReason === "tool_calls") {
    for (const idx of Object.keys(toolCallAccum).map(Number).sort()) {
      const acc = toolCallAccum[idx];
      if (acc.id && acc.name) {
        yield {
          type: "tool_call_done",
          call: { id: acc.id, type: "function", function: { name: acc.name, arguments: acc.args } },
        };
      }
    }
  }
  if (finalReason) {
    yield {
      type: "done",
      finish_reason: finalReason,
      usage: finishOpenAIUsage(usage, config.model, startedAt, firstTokenAt),
    };
  }
}

async function* handleResponsesAPI(
  client: OpenAI,
  messages: Message[],
  config: { model: string; reasoning_effort?: "low" | "medium" | "high" },
  tools?: ToolDefinition[],
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const startedAt = performance.now();
  let firstTokenAt: number | undefined;
  const input = toResponsesInput(messages);
  const toolCallAccum: Record<number, { args: string }> = {};

  const stream = await client.responses.create(
    {
      model: config.model,
      input: input as any,
      stream: true,
      tools: tools?.map((t) => ({
        type: "function" as const,
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })) as any,
      ...(config.reasoning_effort ? { reasoning: { effort: config.reasoning_effort } } : {}),
    },
    { signal },
  );

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      firstTokenAt ??= performance.now();
      yield { type: "content", text: (event as any).delta };
    } else if (event.type === "response.function_call_arguments.delta") {
      const idx = (event as any).content_index ?? 0;
      if (!toolCallAccum[idx]) toolCallAccum[idx] = { args: "" };
      toolCallAccum[idx].args += (event as any).delta;
    } else if (event.type === "response.completed") {
      const response = (event as any).response;
      const ru = response?.usage;
      let usage: UsageInfo | undefined;
      if (ru) {
        usage = {
          prompt_tokens: ru.input_tokens ?? 0,
          completion_tokens: ru.output_tokens ?? 0,
          total_tokens: ru.total_tokens ?? 0,
          cached_tokens: ru.input_tokens_details?.cached_tokens ?? 0,
          reasoning_tokens: ru.output_tokens_details?.reasoning_tokens ?? 0,
        };
        usage = finishOpenAIUsage(usage, config.model, startedAt, firstTokenAt);
      }

      const output: Array<Record<string, unknown>> = response?.output ?? [];
      for (const item of output) {
        if (item.type === "function_call") {
          const callId = (item.call_id || item.id) as string;
          if (!callId) continue;
          yield {
            type: "tool_call_done",
            call: {
              id: callId,
              type: "function",
              function: {
                name: item.name as string,
                arguments:
                  typeof item.arguments === "string"
                    ? item.arguments
                    : JSON.stringify(item.arguments),
              },
            },
          };
        }
      }

      const hasToolCalls = output.some((o) => o.type === "function_call");
      yield { type: "done", finish_reason: hasToolCalls ? "tool_calls" : "stop", usage };
    }
  }
}

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
    apiKey: config.apiKey || "dummy-key-for-local",
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true,
  });

  try {
    yield* handleChatCompletion(client, messages, config, tools, signal);
  } catch (err: any) {
    if (err?.status === 404 && err.message?.toLowerCase().includes("responses")) {
      yield* handleResponsesAPI(client, messages, config, tools, signal);
      return;
    }
    throw err;
  }
}
