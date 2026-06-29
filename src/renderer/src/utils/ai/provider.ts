import { providers } from "./index";

export function providerForBaseUrl(baseUrl: string): string {
  if (baseUrl.includes("11434")) return "ollama";
  if (baseUrl.includes("1234")) return "lmstudio";
  if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) return "ollama";
  return (
    providers.find((p) => baseUrl.startsWith(p.baseUrl.replace("/api/v1", "").replace("/v1", "")))
      ?.id ?? "custom"
  );
}
