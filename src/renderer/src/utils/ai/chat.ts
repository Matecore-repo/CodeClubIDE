import type { Message, StreamEvent, ToolDefinition, UsageInfo, ModelInfo } from "./types";

export async function fetchModels(
  config: { apiKey: string; baseUrl: string },
  query?: string,
): Promise<ModelInfo[]> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/models${query ?? ""}`;
  try {
    const res = await window.api.proxyFetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "HTTP-Referer": "https://opencode.ai/",
        "X-Title": "codeclub",
        "X-Source": "opencode",
      },
    });
    if (!res.ok) return [];
    const json = JSON.parse(res.data);
    return (json.data ?? []).map((m: { id: string; context_length?: number }) => ({
      id: m.id,
      context: m.context_length ?? undefined,
    }));
  } catch {
    return [];
  }
}

export async function validateKey(config: {
  apiKey: string;
  baseUrl: string;
  model?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const base = config.baseUrl.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "HTTP-Referer": "https://opencode.ai/",
    "X-Title": "codeclub",
  };

  // Mandatory: Lightweight chat completion validates key for all providers
  // We no longer rely on /models as it can be public (e.g. OpenRouter)
  const model = config.model ?? "gpt-4o-mini";
  try {
    const res = await window.api.proxyFetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "." }], max_tokens: 1 }),
    });
    if (res.ok) return { ok: true };

    // For local servers (Ollama/LM Studio), they might return 400 Bad Request if the default model isn't downloaded yet.
    // As long as the server responded (no exception thrown), we assume it's valid.
    if (base.includes("localhost") || base.includes("127.0.0.1")) {
      return { ok: true };
    }

    return { ok: false, error: `${res.status}: ${res.data.slice(0, 200)}` };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error).message };
  }
}

const chatCache = new Map<string, StreamEvent[]>();
let cacheInitialized = false;

async function ensureCacheLoaded() {
  if (cacheInitialized) return;
  cacheInitialized = true;
  try {
    const raw = await window.api.storeGet("cache", "completions");
    if (raw && Array.isArray(raw)) {
      for (const [key, value] of raw) {
        chatCache.set(key, value);
      }
    }
  } catch (err) {
    console.warn("Failed to load completions cache:", err);
  }
}

export async function* streamChatCompletion(
  messages: Message[],
  config: {
    apiKey: string;
    baseUrl: string;
    model: string;
    reasoning_effort?: "low" | "medium" | "high";
    endpoint?: string;
  },
  tools?: ToolDefinition[],
  _signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  await ensureCacheLoaded();
  const cacheKey = JSON.stringify({ messages, model: config.model });
  if (chatCache.has(cacheKey)) {
    const cachedEvents = chatCache.get(cacheKey)!;
    for (const event of cachedEvents) {
      yield event;
    }
    return;
  }

  const endpoint = config.endpoint ?? "/chat/completions";
  const url = `${config.baseUrl.replace(/\/$/, "")}${endpoint}`;
  const body: Record<string, unknown> = { model: config.model, messages, stream: true };
  if (tools && tools.length > 0) body.tools = tools;
  if (config.reasoning_effort) body.reasoning_effort = config.reasoning_effort;

  const streamId = await window.api.proxyFetchStream(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": "https://opencode.ai/",
      "X-Title": "codeclub",
    },
    body: JSON.stringify(body),
  });

  const toolCallAccum: Record<number, { id?: string; name?: string; args: string }> = {};
  let usage: UsageInfo | undefined;
  let buffer = "";
  let isDone = false;
  let error: string | null = null;
  const queue: StreamEvent[] = [];
  let resolveNext: (() => void) | null = null;

  const cleanup = () => {
    unData();
    unDone();
    unError();
  };

  const unData = window.api.onStreamData(streamId, (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          console.error(`[Stream] ${streamId} API Error:`, parsed.error);
          error =
            typeof parsed.error === "string"
              ? parsed.error
              : parsed.error.message || JSON.stringify(parsed.error);
          isDone = true;
          resolveNext?.();
          return;
        }
        if (parsed.usage) {
          usage = {
            prompt_tokens: parsed.usage.prompt_tokens,
            completion_tokens: parsed.usage.completion_tokens,
            total_tokens: parsed.usage.total_tokens,
          };
        }

        const choice = parsed.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta || {};
        const finishReason = choice.finish_reason;

        if (delta.content) {
          queue.push({ type: "content", text: delta.content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallAccum[idx]) toolCallAccum[idx] = { args: "" };
            if (tc.id) toolCallAccum[idx].id = tc.id;
            if (tc.function?.name) toolCallAccum[idx].name = tc.function.name;
            if (tc.function?.arguments) toolCallAccum[idx].args += tc.function.arguments;
          }
        }

        if (finishReason) {
          if (finishReason === "tool_calls") {
            for (const idx of Object.keys(toolCallAccum).map(Number).sort()) {
              const acc = toolCallAccum[idx];
              if (acc.id && acc.name) {
                queue.push({
                  type: "tool_call_done",
                  call: {
                    id: acc.id,
                    type: "function",
                    function: { name: acc.name, arguments: acc.args },
                  },
                });
              }
            }
            queue.push({ type: "done", finish_reason: "tool_calls", usage });
          } else if (finishReason === "stop") {
            queue.push({ type: "done", finish_reason: "stop", usage });
          } else {
            queue.push({ type: "done", finish_reason: finishReason as any, usage });
          }
        }
        resolveNext?.();
      } catch (e) {
        console.warn(`[Stream] ${streamId} Parse error on line:`, trimmed, e);
      }
    }
  });

  const unDone = window.api.onStreamDone(streamId, () => {
    isDone = true;
    resolveNext?.();
  });

  const unError = window.api.onStreamError(streamId, (err) => {
    console.error(`[Stream] ${streamId} ERROR:`, err);
    error = err;
    isDone = true;
    resolveNext?.();
  });

  const recordedEvents: StreamEvent[] = [];
  try {
    while (!isDone || queue.length > 0) {
      if (queue.length > 0) {
        const ev = queue.shift()!;
        recordedEvents.push(ev);
        yield ev;
        continue;
      }
      if (isDone) break;
      await new Promise<void>((r) => {
        resolveNext = r;
      });
      resolveNext = null;
      if (error) throw new Error(error);
    }
    // Only cache successful standard responses to avoid caching partial/error states
    if (recordedEvents.some((ev) => ev.type === "done" && ev.finish_reason === "stop")) {
      chatCache.set(cacheKey, recordedEvents);
      window.api
        .storeSet("cache", "completions", Array.from(chatCache.entries()))
        .catch((err: any) => console.warn("Failed to persist completions cache:", err));
    }
  } finally {
    cleanup();
  }
}
