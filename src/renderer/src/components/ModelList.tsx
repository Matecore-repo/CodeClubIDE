import type { AIConfig, ModelInfo } from "../utils/ai";
import { providerModelSupportsReasoning } from "../utils/ai";
import Select from "./Select";

export function ModelList({
  config,
  fetchedModels,
  providerId,
  onConfigChange,
}: {
  config: AIConfig | null;
  fetchedModels: ModelInfo[] | null;
  providerId: string;
  onConfigChange?: (c: AIConfig) => void;
}) {
  const selectedModel = fetchedModels?.find((model) => model.id === config?.model);
  const supportsReasoning = providerModelSupportsReasoning(providerId, selectedModel);

  return (
    <>
      <span
        style={{
          width: 22,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-weak)",
        }}
        title="Model"
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
          <path d="M12 2v20M2 12h20" />
          <path d="M5 5c4 4 10 4 14 0M5 19c4-4 10-4 14 0" />
        </svg>
      </span>
      <Select
        value={config?.model ?? ""}
        onChange={(v) => {
          const fallback: AIConfig = config ?? {
            apiKey: "",
            baseUrl: "https://openrouter.ai/api/v1",
            model: "openai/gpt-4o-mini",
          };
          onConfigChange?.({ ...fallback, model: v });
        }}
        options={(fetchedModels ?? []).map((m) => ({ value: m.id, label: m.id }))}
      />
      {supportsReasoning && (
        <>
          <span style={{ fontSize: 12, color: "var(--text-weaker)", lineHeight: "22px" }}>
            Reasoning
          </span>
          <Select
            value={config?.reasoning_effort ?? "medium"}
            onChange={(v) => {
              if (!config) return;
              onConfigChange?.({ ...config, reasoning_effort: v as "low" | "medium" | "high" });
            }}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            width={88}
          />
        </>
      )}
    </>
  );
}
