import { useState, useEffect, useRef } from "react";
import type { AIConfig } from "../utils/ai";
import { validateKey, providers } from "../utils/ai";

export function ApiSettingsKeysView({ onSave }: { onSave: (c: AIConfig) => void }) {
  const [savedKeys, setSavedKeys] = useState<Record<string, { apiKey: string; baseUrl: string }>>(
    {},
  );
  const [providerId, setProviderId] = useState("openrouter");
  const [baseUrl, setBaseUrl] = useState("https://openrouter.ai/api/v1");
  const [apiKey, setApiKey] = useState("");
  const [validating, setValidating] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    window.api.storeGet("ai", "keys").then((val) => {
      const keys = (val ?? {}) as Record<string, { apiKey: string; baseUrl: string }>;
      setSavedKeys(keys);
      if (firstLoad.current) {
        const pid = providerId;
        setBaseUrl(
          keys[pid]?.baseUrl ??
            providers.find((p) => p.id === pid)?.baseUrl ??
            "https://openrouter.ai/api/v1",
        );
        setApiKey(keys[pid]?.apiKey ?? "");
        firstLoad.current = false;
      }
    });
  }, []);

  const handleProviderChange = (id: string) => {
    setProviderId(id);
    const p = providers.find((pr) => pr.id === id);
    if (p) {
      setBaseUrl(savedKeys[id]?.baseUrl ?? p.baseUrl);
      setApiKey(savedKeys[id]?.apiKey ?? "");
    }
    setStatus(null);
  };

  const handleValidate = async () => {
    setValidating(true);
    setStatus(null);
    const r = await validateKey({ apiKey: requiresKey ? apiKey : "local", baseUrl });
    setValidating(false);
    if (r.ok) {
      const next = { ...savedKeys, [providerId]: { apiKey, baseUrl } };
      setSavedKeys(next);
      window.api.storeSet("ai", "keys", next);
      onSave({
        apiKey,
        baseUrl,
        model: providers.find((p) => p.id === providerId)?.defaultModel ?? "openai/gpt-4o-mini",
      });
      setStatus({ ok: true, msg: "Valid key" });
      setTimeout(() => setStatus(null), 3000);
    } else {
      setStatus({ ok: false, msg: r.error ?? "Invalid key" });
    }
  };

  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.name ?? id;
  const requiresKey = !["ollama", "lmstudio", "custom"].includes(providerId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontSize: "var(--font-size-base)",
            fontWeight: 500,
            color: "var(--text-strong)",
            marginBottom: 12,
          }}
        >
          {savedKeys[providerId]?.apiKey
            ? `Edit ${providerLabel(providerId)}`
            : `Add ${providerLabel(providerId)} Key`}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: "var(--font-size-small)",
                color: "var(--text-weaker)",
                minWidth: 60,
              }}
            >
              Provider
            </span>
            <select
              value={providerId}
              onChange={(e) => handleProviderChange(e.target.value)}
              style={{
                padding: "6px 9px",
                borderRadius: 3,
                border: "1px solid #2a2a30",
                background: "#151515",
                color: "var(--text-strong)",
                fontSize: "var(--font-size-small)",
                outline: "none",
              }}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {savedKeys[providerId]?.apiKey && (
              <span style={{ fontSize: 11, color: "var(--text-weaker)" }}>Saved</span>
            )}
          </div>

          <div>
            {!["ollama", "lmstudio", "custom"].includes(providerId) && (
              <div
                style={{
                  fontSize: "var(--font-size-small)",
                  color: "var(--text-weaker)",
                  marginBottom: 4,
                }}
              >
                Base URL
              </div>
            )}
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              style={{
                padding: "6px 9px",
                borderRadius: 3,
                border: "1px solid #2a2a30",
                background: "#151515",
                color: "var(--text-strong)",
                fontSize: "var(--font-size-small)",
                outline: "none",
                fontFamily: "var(--font-family-mono)",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <div
              style={{
                fontSize: "var(--font-size-small)",
                color: "var(--text-weaker)",
                marginBottom: 4,
              }}
            >
              API Key
            </div>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              type="password"
              style={{
                padding: "6px 9px",
                borderRadius: 3,
                border: "1px solid #2a2a30",
                background: "#151515",
                color: "var(--text-strong)",
                fontSize: "var(--font-size-small)",
                outline: "none",
                fontFamily: "var(--font-family-mono)",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handleValidate}
              disabled={validating || (requiresKey && !apiKey)}
              style={{
                padding: "6px 12px",
                borderRadius: 3,
                border: "1px solid #242428",
                background: "#151515",
                color: "var(--text-strong)",
                fontSize: "var(--font-size-small)",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {validating ? "Testing..." : "Validate & Save"}
            </button>
            {status && (
              <span
                style={{
                  fontSize: "var(--font-size-small)",
                  color: status.ok ? "var(--text-positive)" : "var(--text-on-critical-base)",
                }}
              >
                {status.msg}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
