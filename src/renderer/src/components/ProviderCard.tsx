import type { AIConfig } from "../utils/ai";
import { providers } from "../utils/ai";
import Select from "./Select";

function resolveProviderConfig(
  providerId: string,
  config: AIConfig | null,
  savedKeys: Record<string, { apiKey: string; baseUrl: string }>,
): AIConfig {
  const p = providers.find((pr) => pr.id === providerId);
  if (!p)
    return (
      config ?? { apiKey: "", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" }
    );
  const fallback: AIConfig = config ?? {
    apiKey: "",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
  };
  let key = savedKeys[providerId]?.apiKey ?? "";
  if (!key && (providerId === "opencode-go" || providerId === "opencode-zen")) key = "public";
  const baseUrl = savedKeys[providerId]?.baseUrl ?? p.baseUrl;
  return { ...fallback, apiKey: key, baseUrl, model: p.defaultModel, reasoning_effort: undefined };
}

export function ProviderCard({
  providerId,
  config,
  savedKeys,
  onConfigChange,
}: {
  providerId: string;
  config: AIConfig | null;
  savedKeys: Record<string, { apiKey: string; baseUrl: string }>;
  onConfigChange?: (c: AIConfig) => void;
}) {
  return (
    <>
      <span
        style={{
          width: 22,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-strong)",
        }}
        title="Provider"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3 4 7l8 4 8-4-8-4Z" />
          <path d="m4 12 8 4 8-4" />
          <path d="m4 17 8 4 8-4" />
        </svg>
      </span>
      <Select
        value={providerId}
        onChange={(v) => onConfigChange?.(resolveProviderConfig(v, config, savedKeys))}
        options={providers.map((p) => ({ value: p.id, label: p.name }))}
      />
    </>
  );
}
