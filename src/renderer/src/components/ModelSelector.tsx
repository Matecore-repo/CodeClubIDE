import { useState } from "react";
import type { AIConfig, ModelInfo } from "../utils/ai";
import { ProviderCard } from "./ProviderCard";
import { ModelList } from "./ModelList";
import { providerForBaseUrl } from "../utils/ai/provider";

export function ModelSelector({
  config,
  onConfigChange,
  fetchedModels,
  savedKeys,
  isInputVisible = true,
  workspacePath,
  sandbox,
  toggleSandbox,
  activeColor,
  showChat: _showChat,
  setShowChat: _setShowChat,
  showTerminal,
  setShowTerminal,
  showGraph,
  setShowGraph,
  filePath,
  studioMode,
}: {
  config: AIConfig | null;
  onConfigChange?: (c: AIConfig) => void;
  fetchedModels: ModelInfo[] | null;
  savedKeys: Record<string, { apiKey: string; baseUrl: string }>;
  isInputVisible?: boolean;
  workspacePath?: string | null;
  sandbox: boolean;
  toggleSandbox: () => void;
  activeColor?: string;
  showChat: boolean;
  setShowChat: (v: boolean) => void;
  showTerminal: boolean;
  setShowTerminal: (v: boolean) => void;
  showGraph: boolean;
  setShowGraph: (v: boolean) => void;
  filePath?: string | null;
  studioMode?: boolean;
}) {
  const providerId = providerForBaseUrl(config?.baseUrl ?? "https://openrouter.ai/api/v1");

  const [showReview, setShowReview] = useState(false);

  const [topographicalMode, setTopographicalMode] = useState(() => {
    return (
      typeof window !== "undefined" &&
      window.localStorage &&
      window.localStorage.getItem("topographicalMode") === "true"
    );
  });

  const _toggleTopographicalMode = () => {
    const next = !topographicalMode;
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("topographicalMode", String(next));
    }
    setTopographicalMode(next);
  };

  const accentColor = activeColor || "var(--accent-base)";

  const getButtonStyle = (isActive: boolean) => ({
    border: "none",
    background: "transparent",
    color: isActive ? accentColor : "var(--text-weak)",
    cursor: "pointer",
    width: 24,
    height: 24,
    borderRadius: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.2s, background 0.2s",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        margin: "0 18px 10px",
        padding: "4px 6px",
        borderRadius: 4,
        background: "#141414",
        border: "1px solid #202024",
        boxShadow: "0 10px 28px rgba(0,0,0,0.34)",
      }}
    >
      <ProviderCard
        providerId={providerId}
        config={config}
        savedKeys={savedKeys}
        onConfigChange={onConfigChange}
      />
      <ModelList
        config={config}
        fetchedModels={fetchedModels}
        providerId={providerId}
        onConfigChange={onConfigChange}
      />
      <div style={{ flex: 1 }} />

      {workspacePath && (
        <button
          title={showReview ? "Close Review Changes" : "Review Changes"}
          onClick={() => {
            setShowReview(!showReview);
            window.dispatchEvent(new CustomEvent("codeclub:toggle-review"));
          }}
          style={getButtonStyle(showReview)}
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
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M9 10h6" />
            <path d="M12 7v6" />
            <path d="M9 17h6" />
          </svg>
        </button>
      )}

      {workspacePath && (filePath || showTerminal || showGraph) && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("codeclub:toggle-chat-input"))}
          style={getButtonStyle(isInputVisible)}
          title="Chat input"
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
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {workspacePath && !studioMode && !filePath && (
        <button
          onClick={() => setShowGraph(!showGraph)}
          style={getButtonStyle(showGraph)}
          title={showGraph ? "Close Graph" : "Graph View"}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {workspacePath && (
        <button
          onClick={toggleSandbox}
          style={getButtonStyle(sandbox)}
          title={
            sandbox
              ? "Sandbox Mode: ACTIVE (Agent can run bash/write autonomously)"
              : "Sandbox Mode: OFF (Safe mode)"
          }
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
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>
      )}

      {workspacePath && !studioMode && (
        <button
          onClick={() => setShowTerminal(!showTerminal)}
          style={getButtonStyle(showTerminal)}
          title={showTerminal ? "Close Terminal" : "Open Terminal"}
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
            <path d="m4 17 6-6-6-6" />
            <path d="M12 19h8" />
          </svg>
        </button>
      )}

      <button
        onClick={() => window.dispatchEvent(new CustomEvent("codeclub:show-donation-banner"))}
        style={{ ...getButtonStyle(false), color: activeColor || "#e0895e" }}
        title="Support codeclub"
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
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      </button>
    </div>
  );
}
