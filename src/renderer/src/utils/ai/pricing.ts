const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-2024-08-06": { input: 2.5, output: 10.0 },
  "gpt-4o-2024-05-13": { input: 5.0, output: 15.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "gpt-4": { input: 30.0, output: 60.0 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet-latest": { input: 3.0, output: 15.0 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4.0 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  "claude-3-opus-latest": { input: 15.0, output: 75.0 },
  "gemini-1.5-pro": { input: 3.5, output: 10.5 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-coder": { input: 0.14, output: 0.28 },
  "mistral-large": { input: 2.0, output: 6.0 },
  "mistral-small": { input: 0.2, output: 0.6 },
  "llama-3.1-70b": { input: 0.59, output: 0.79 },
  "llama-3.1-8b": { input: 0.06, output: 0.08 },
  "qwen-2.5-72b": { input: 0.9, output: 0.9 },
};

function normalizeModel(model: string): string {
  const m = model.toLowerCase();
  if (m.startsWith("openai/")) return m.slice(7);
  if (m.startsWith("openrouter/")) return m.slice(11);
  if (m.startsWith("anthropic/")) return m.slice(10);
  if (m.startsWith("google/")) return m.slice(7);
  if (m.startsWith("mistralai/")) return m.slice(10);
  if (m.startsWith("meta-llama/")) return m.slice(11);
  if (m.startsWith("deepseek/")) return m.slice(9);
  return m;
}

function matchModel(model: string): { input: number; output: number } | null {
  const key = normalizeModel(model);
  if (PRICING[key]) return PRICING[key];
  for (const [k, v] of Object.entries(PRICING)) {
    if (key.startsWith(k)) return v;
  }
  const base = key.split("-").slice(0, 2).join("-");
  if (base !== key && PRICING[base]) return PRICING[base];
  return null;
}

export function modelCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): { promptCost: number; completionCost: number; total: number } | null {
  const price = matchModel(model);
  if (!price) return null;
  const promptCost = (promptTokens / 1_000_000) * price.input;
  const completionCost = (completionTokens / 1_000_000) * price.output;
  return { promptCost, completionCost, total: promptCost + completionCost };
}
