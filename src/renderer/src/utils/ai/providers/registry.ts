import type { Message, ModelInfo, StreamEvent, ToolDefinition } from "../types";

export type StreamCompletionFunc = (
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
) => AsyncGenerator<StreamEvent>;

export interface RegisteredProvider {
  id: string;
  streamCompletion: StreamCompletionFunc;
  filterModels?: (models: ModelInfo[]) => ModelInfo[];
  supportsReasoning?: (model: ModelInfo | undefined) => boolean;
}

const registry: Record<string, RegisteredProvider> = {};

export function registerProvider(provider: RegisteredProvider) {
  registry[provider.id] = provider;
}

export function getProvider(id: string): RegisteredProvider | undefined {
  return registry[id];
}

export function filterProviderModels(id: string, models: ModelInfo[]): ModelInfo[] {
  return registry[id]?.filterModels?.(models) ?? models;
}

export function providerModelSupportsReasoning(id: string, model: ModelInfo | undefined): boolean {
  return registry[id]?.supportsReasoning?.(model) ?? false;
}
