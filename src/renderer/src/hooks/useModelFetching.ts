import { useState, useEffect, useMemo } from "react";
import type { AIConfig, ModelInfo, ModelCatalog } from "../utils/ai";
import { fetchModelCatalog, catalogToModelInfos } from "../utils/ai";
import { fetchModels, filterProviderModels, getHardcodedModels } from "../utils/ai";
import { providerForBaseUrl } from "../utils/ai/provider";

export function useModelFetching(config: AIConfig | null) {
  const [fetchedModels, setFetchedModels] = useState<ModelInfo[] | null>(null);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [savedKeys, setSavedKeys] = useState<Record<string, { apiKey: string; baseUrl: string }>>(
    {},
  );

  useEffect(() => {
    fetchModelCatalog().then(setCatalog);
  }, []);

  useEffect(() => {
    window.api.storeGet("ai", "keys").then((val) => {
      if (val && typeof val === "object")
        setSavedKeys(val as Record<string, { apiKey: string; baseUrl: string }>);
    });
  }, [config?.apiKey, config?.baseUrl]);

  const catalogProviderId = useMemo(() => {
    const b = config?.baseUrl ?? "";
    if (b.includes("opencode.ai/go")) return "opencode";
    if (b.includes("opencode.ai/zen")) return "opencode";
    return providerForBaseUrl(b);
  }, [config?.baseUrl]);

  const modelsFromCatalog = useMemo(() => {
    if (!catalog) return null;
    const models = catalogToModelInfos(catalog, catalogProviderId);
    return models.length > 0 ? models : null;
  }, [catalog, catalogProviderId]);

  useEffect(() => {
    if (!config?.baseUrl) {
      setFetchedModels(null);
      return;
    }

    const pid = providerForBaseUrl(config?.baseUrl ?? "");
    const hardcoded = getHardcodedModels(pid);
    if (hardcoded) {
      setFetchedModels(filterProviderModels(pid, hardcoded));
      return;
    }
    if (modelsFromCatalog) {
      setFetchedModels(filterProviderModels(pid, modelsFromCatalog));
      return;
    }
    if (
      !config?.apiKey &&
      pid !== "opencode-go" &&
      pid !== "opencode-zen" &&
      pid !== "ollama" &&
      pid !== "lmstudio" &&
      pid !== "custom"
    ) {
      setFetchedModels(null);
      return;
    }
    setFetchedModels(null);
    fetchModels(config).then((models) => {
      const filtered = filterProviderModels(pid, models);
      setFetchedModels(filtered.length > 0 ? filtered : null);
    });
  }, [config?.baseUrl, config?.apiKey, modelsFromCatalog]);

  return { fetchedModels, savedKeys, catalog };
}
