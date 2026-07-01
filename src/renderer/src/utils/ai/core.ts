import type { Message, StreamEvent, ToolDefinition, ModelInfo } from "./types";
import { fetchModels as genericFetchModels, validateKey as genericValidateKey } from "./chat";
import { getProvider } from "./providers/registry";
import { parseXmlToolCalls, withXmlTools } from "./tools/xml";

export interface ProviderInfo {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
}

export const providers: ProviderInfo[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-7-sonnet-20250219",
  },
  {
    id: "google",
    name: "Google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    baseUrl: "https://opencode.ai/zen/go/v1",
    defaultModel: "deepseek-v4-flash",
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    defaultModel: "deepseek-v4-flash-free",
  },
  {
    id: "ollama",
    name: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2:latest",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    defaultModel: "local-model",
  },
  {
    id: "custom",
    name: "Custom",
    baseUrl: "http://localhost:8000/v1",
    defaultModel: "local-model",
  },
];

export const OPENCODE_ZEN_MODELS: ModelInfo[] = [
  { id: "gpt-5.5", endpoint: "/responses" },
  { id: "gpt-5.5-pro", endpoint: "/responses" },
  { id: "gpt-5.4", endpoint: "/responses" },
  { id: "gpt-5.4-pro", endpoint: "/responses" },
  { id: "gpt-5.4-mini", endpoint: "/responses" },
  { id: "gpt-5.4-nano", endpoint: "/responses" },
  { id: "gpt-5.3-codex", endpoint: "/responses" },
  { id: "gpt-5.3-codex-spark", endpoint: "/responses" },
  { id: "gpt-5.2", endpoint: "/responses" },
  { id: "gpt-5.2-codex", endpoint: "/responses" },
  { id: "gpt-5.1", endpoint: "/responses" },
  { id: "gpt-5.1-codex", endpoint: "/responses" },
  { id: "gpt-5.1-codex-max", endpoint: "/responses" },
  { id: "gpt-5.1-codex-mini", endpoint: "/responses" },
  { id: "gpt-5", endpoint: "/responses" },
  { id: "gpt-5-codex", endpoint: "/responses" },
  { id: "gpt-5-nano", endpoint: "/responses" },
  { id: "claude-fable-5", endpoint: "/messages" },
  { id: "claude-opus-4-8", endpoint: "/messages" },
  { id: "claude-opus-4-7", endpoint: "/messages" },
  { id: "claude-opus-4-6", endpoint: "/messages" },
  { id: "claude-opus-4-5", endpoint: "/messages" },
  { id: "claude-opus-4-1", endpoint: "/messages" },
  { id: "claude-sonnet-4-6", endpoint: "/messages" },
  { id: "claude-sonnet-4-5", endpoint: "/messages" },
  { id: "claude-sonnet-4", endpoint: "/messages" },
  { id: "claude-haiku-4-5", endpoint: "/messages" },
  { id: "claude-3-5-haiku", endpoint: "/messages" },
  { id: "gemini-3.5-flash", endpoint: "/models/gemini-3.5-flash" },
  { id: "gemini-3.1-pro", endpoint: "/models/gemini-3.1-pro" },
  { id: "gemini-3-flash", endpoint: "/models/gemini-3-flash" },
  { id: "qwen3.7-max", endpoint: "/messages" },
  { id: "qwen3.7-plus", endpoint: "/messages" },
  { id: "qwen3.6-plus", endpoint: "/messages" },
  { id: "qwen3.5-plus", endpoint: "/messages" },
  { id: "deepseek-v4-pro", endpoint: "/chat/completions" },
  { id: "deepseek-v4-flash", endpoint: "/chat/completions" },
  { id: "minimax-m2.7", endpoint: "/chat/completions" },
  { id: "minimax-m2.5", endpoint: "/chat/completions" },
  { id: "glm-5.1", endpoint: "/chat/completions" },
  { id: "glm-5", endpoint: "/chat/completions" },
  { id: "kimi-k2.5", endpoint: "/chat/completions" },
  { id: "kimi-k2.6", endpoint: "/chat/completions" },
  { id: "grok-build-0.1", endpoint: "/chat/completions" },
  { id: "big-pickle", endpoint: "/chat/completions" },
  { id: "mimo-v2.5-free", endpoint: "/chat/completions" },
  { id: "north-mini-code-free", endpoint: "/chat/completions" },
  { id: "nemotron-3-ultra-free", endpoint: "/chat/completions" },
  { id: "deepseek-v4-flash-free", endpoint: "/chat/completions" },
];

export const OPENCODE_GO_MODELS: ModelInfo[] = [
  { id: "deepseek-v4-pro" },
  { id: "deepseek-v4-flash" },
  { id: "glm-5.1" },
  { id: "glm-5" },
  { id: "kimi-k2.5" },
  { id: "kimi-k2.6" },
  { id: "mimo-v2.5" },
  { id: "mimo-v2.5-pro" },
  { id: "minimax-m2.5" },
  { id: "minimax-m2.7" },
  { id: "minimax-m3" },
  { id: "qwen3.6-plus" },
  { id: "qwen3.7-plus" },
  { id: "qwen3.7-max" },
];

export function getHardcodedModels(providerId: string): ModelInfo[] | null {
  if (providerId === "opencode-zen") return OPENCODE_ZEN_MODELS;
  if (providerId === "opencode-go") return OPENCODE_GO_MODELS;
  return null;
}

export function providerFromUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    // fallback for non-URL strings (e.g. bare hostname:port)
    if (baseUrl.includes("11434")) return "ollama";
    if (baseUrl.includes("1234")) return "lmstudio";
    return "custom";
  }

  const { hostname, port, pathname } = url;

  if (port === "11434") return "ollama";
  if (port === "1234") return "lmstudio";
  if (hostname === "localhost" || hostname === "127.0.0.1") return "ollama";
  if (hostname === "anthropic.com" || hostname.endsWith(".anthropic.com")) return "anthropic";
  if (hostname === "googleapis.com" || hostname.endsWith(".googleapis.com")) return "google";
  if (hostname === "openai.com" || hostname.endsWith(".openai.com")) return "openai";
  if (hostname === "opencode.ai" || hostname.endsWith(".opencode.ai")) {
    if (pathname.includes("/zen/go") || pathname.includes("/go")) return "opencode-go";
    if (pathname.includes("/zen")) return "opencode-zen";
  }
  return "custom";
}

export async function fetchModels(config: {
  apiKey: string;
  baseUrl: string;
  customHeaders?: Record<string, string>;
}): Promise<ModelInfo[]> {
  const p = providerFromUrl(config.baseUrl);
  const apiKey =
    config.apiKey || (p === "opencode-go" || p === "opencode-zen" ? "public" : config.apiKey);
  if (p === "openrouter") {
    return genericFetchModels({ ...config, apiKey }, "?supported_parameters=tools");
  }
  return genericFetchModels({ ...config, apiKey });
}

export async function validateKey(config: {
  apiKey: string;
  baseUrl: string;
  model?: string;
  customHeaders?: Record<string, string>;
  customBody?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const p = providerFromUrl(config.baseUrl);
  const apiKey =
    config.apiKey || (p === "opencode-go" || p === "opencode-zen" ? "public" : config.apiKey);
  const defaultModel = providers.find((pr) => pr.id === p)?.defaultModel;
  const model = config.model ?? defaultModel ?? "gpt-4o-mini";
  return genericValidateKey({ ...config, apiKey, model });
}

export async function* streamCompletion(
  messages: Message[],
  config: {
    apiKey: string;
    baseUrl: string;
    model: string;
    reasoning_effort?: "low" | "medium" | "high";
    toolProtocol?: "json" | "xml";
    customHeaders?: Record<string, string>;
    customBody?: Record<string, unknown>;
  },
  tools?: ToolDefinition[],
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const providerId = providerFromUrl(config.baseUrl);

  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Provider not found: ${providerId}`);

  const apiKey =
    config.apiKey ||
    (providerId === "opencode-go" || providerId === "opencode-zen" ? "public" : config.apiKey);
  const hardcoded = getHardcodedModels(providerId);
  const endpoint = hardcoded?.find((m) => m.id === config.model)?.endpoint;
  const toolProtocol =
    config.toolProtocol ?? (providerId === "ollama" || providerId === "lmstudio" ? "xml" : "json");
  if (toolProtocol !== "xml") {
    yield* provider.streamCompletion(messages, { ...config, apiKey, endpoint }, tools, signal);
    return;
  }
  let content = "";
  for await (const event of provider.streamCompletion(
    withXmlTools(messages, tools),
    { ...config, apiKey, endpoint },
    undefined,
    signal,
  )) {
    if (event.type === "content") content += event.text;
    else if (event.type !== "done") yield event;
  }
  const parsed = parseXmlToolCalls(content);
  if (parsed.content) yield { type: "content", text: parsed.content };
  for (const call of parsed.calls) yield { type: "tool_call_done", call };
  yield { type: "done", finish_reason: parsed.calls.length ? "tool_calls" : "stop" };
}
