import type { ModelCatalog, ModelInfo } from "./types";

const CATALOG_URL = "https://models.dev/api.json";
let cached: ModelCatalog | null = null;

export async function fetchModelCatalog(): Promise<ModelCatalog> {
  if (cached) return cached;
  try {
    const res = await window.api.proxyFetch(CATALOG_URL);
    if (!res.ok) return {};
    cached = JSON.parse(res.data) as ModelCatalog;
    return cached;
  } catch {
    return {};
  }
}

export function catalogToModelInfos(catalog: ModelCatalog, providerId: string): ModelInfo[] {
  const provider = catalog[providerId];
  if (!provider?.models) return [];
  return Object.values(provider.models).map((m) => ({
    id: m.id,
    context: m.limit?.context,
    reasoning: m.reasoning,
    tool_call: m.tool_call,
  }));
}

export function providerSupportsReasoning(
  catalog: ModelCatalog,
  providerId: string,
  modelId: string,
): boolean {
  const provider = catalog[providerId];
  if (!provider?.models) return false;
  const model = provider.models[modelId];
  return model?.reasoning ?? false;
}
