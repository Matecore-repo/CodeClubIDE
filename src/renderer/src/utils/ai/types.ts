export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  reasoning_effort?: "low" | "medium" | "high";
  toolProtocol?: "json" | "xml";
  customHeaders?: Record<string, string>;
  customBody?: Record<string, unknown>;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms?: number;
  time_to_first_token_ms?: number;
  cached_tokens?: number;
  reasoning_tokens?: number;
  estimated_cost_usd?: number;
  active_tools?: number;
  peak_memory_mb?: number;
}

export interface ModelInfo {
  id: string;
  context?: number;
  reasoning?: boolean;
  tool_call?: boolean;
  endpoint?: string;
}

export interface CatalogModel {
  id: string;
  name: string;
  reasoning?: boolean;
  tool_call?: boolean;
  limit?: { context?: number };
}

export interface CatalogProvider {
  id: string;
  name: string;
  api?: string;
  env?: string[];
  models?: Record<string, CatalogModel>;
}

export type ModelCatalog = Record<string, CatalogProvider>;

const DEFAULT_CONTEXT = 128_000;

export function maxContext(model: string, models?: ModelInfo[]): number {
  if (models) {
    const found = models.find((m) => m.id === model);
    if (found?.context) return found.context;
  }
  return DEFAULT_CONTEXT;
}

export type StreamEvent =
  | { type: "content"; text: string }
  | { type: "tool_call_done"; call: ToolCall }
  | { type: "done"; finish_reason: "stop" | "tool_calls" | "length" | "error"; usage?: UsageInfo };
