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
  const [customHeadersText, setCustomHeadersText] = useState("{}");
  const [customBodyText, setCustomBodyText] = useState("{}");
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
      setCustomHeadersText("{}");
      setCustomBodyText("{}");
    }
    setStatus(null);
  };

  const parseJsonObject = (text: string, label: string) => {
    try {
      const parsed = JSON.parse(text || "{}");
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        return { ok: false as const, error: `${label} must be a JSON object` };
      }
      return { ok: true as const, value: parsed as Record<string, unknown> };
    } catch {
      return { ok: false as const, error: `${label} is invalid JSON` };
    }
  };

  const handleValidate = async () => {
    const cleanBaseUrl = baseUrl.trim().replace(/^["']|["']$/g, "");
    const customHeaders = parseJsonObject(customHeadersText, "Headers");
    const customBody = parseJsonObject(customBodyText, "Body");
    if (providerId === "custom" && !customHeaders.ok) {
      setStatus({ ok: false, msg: customHeaders.error });
      return;
    }
    if (providerId === "custom" && !customBody.ok) {
      setStatus({ ok: false, msg: customBody.error });
      return;
    }
    const extra =
      providerId === "custom"
        ? {
            customHeaders: customHeaders.value as Record<string, string>,
            customBody: customBody.value,
          }
        : {};

    if (providerId === "custom") {
      const next = { ...savedKeys, [providerId]: { apiKey, baseUrl: cleanBaseUrl } };
      setSavedKeys(next);
      window.api.storeSet("ai", "keys", next);
      onSave({
        apiKey,
        baseUrl: cleanBaseUrl,
        model: providers.find((p) => p.id === providerId)?.defaultModel ?? "local-model",
        ...extra,
      });
      setStatus({ ok: true, msg: "Saved" });
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    setValidating(true);
    setStatus(null);
    const r = await validateKey({
      apiKey: requiresKey ? apiKey : "local",
      baseUrl: cleanBaseUrl,
      ...extra,
    });
    setValidating(false);
    if (r.ok) {
      const next = { ...savedKeys, [providerId]: { apiKey, baseUrl: cleanBaseUrl } };
      setSavedKeys(next);
      window.api.storeSet("ai", "keys", next);
      onSave({
        apiKey,
        baseUrl: cleanBaseUrl,
        model: providers.find((p) => p.id === providerId)?.defaultModel ?? "openai/gpt-4o-mini",
        ...extra,
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

          {providerId === "custom" && (
            <>
              <textarea
                value={customHeadersText}
                onChange={(e) => setCustomHeadersText(e.target.value)}
                placeholder='{"Authorization":"Bearer token"}'
                rows={4}
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
                  resize: "vertical",
                }}
              />
              <textarea
                value={customBodyText}
                onChange={(e) => setCustomBodyText(e.target.value)}
                placeholder='{"temperature":0.2}'
                rows={4}
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
                  resize: "vertical",
                }}
              />
            </>
          )}

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
              {providerId === "custom" ? "Save" : validating ? "Testing..." : "Validate & Save"}
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
