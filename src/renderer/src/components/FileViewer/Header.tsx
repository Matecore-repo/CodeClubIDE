import { useState } from "react";
import { s } from "./styles";

export function Header({
  fileName,
  filePath,
  dirty,
  saving,
  _showDiff,
  onBack,
  onSave,
  _onToggleDiff,
  onReset,
  activeColor,
}: {
  fileName: string;
  filePath: string;
  dirty: boolean;
  saving: boolean;
  _showDiff: boolean;
  onBack: () => void;
  onSave: () => void;
  _onToggleDiff: () => void;
  onReset: () => void;
  activeColor?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const _accentColor = activeColor || "var(--surface-brand-base)";

  const getButtonStyle = (btnId: string, isActive: boolean) => {
    const isHovered = hovered === btnId;
    return {
      background: isHovered
        ? "rgba(255, 255, 255, 0.08)"
        : isActive
          ? "rgba(255, 255, 255, 0.04)"
          : "transparent",
      color: isActive ? "var(--text-strong, #fff)" : "var(--text-weaker, #999)",
      border: `1px solid ${isHovered ? "rgba(255, 255, 255, 0.2)" : isActive ? "rgba(255, 255, 255, 0.15)" : "var(--border-weak-base)"}`,
      borderRadius: "4px",
      padding: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition: "all 0.15s ease",
      minWidth: "24px",
      width: "24px",
      height: "24px",
    };
  };

  return (
    <div style={s.header}>
      <button style={s.backBtn} onClick={onBack} title="Back">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <span style={s.fileName}>{fileName}</span>
      <span style={s.filePath}>{filePath}</span>

      {/* Debug Button — disabled temporarily */}
      {/* <button
        style={getButtonStyle("debug", false)}
        onClick={() => filePath && window.dispatchEvent(new CustomEvent("codeclub:debug-open", { detail: { program: filePath } }))}
        title="Run & Debug"
        onMouseEnter={() => setHovered("debug")}
        onMouseLeave={() => setHovered(null)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="6" width="8" height="14" rx="4" />
          <path d="m19 7-3 2" /><path d="m5 7 3 2" />
          <path d="m19 19-3-2" /><path d="m5 19 3-2" />
          <path d="M20 13h-4" /><path d="M4 13h4" />
          <path d="m9 4 1 2" /><path d="m15 4-1 2" />
        </svg>
      </button> */}

      {dirty && (
        <>
          {/* 2. Reset Button */}
          <button
            style={getButtonStyle("reset", false)}
            onClick={onReset}
            title="Reset Changes"
            onMouseEnter={() => setHovered("reset")}
            onMouseLeave={() => setHovered(null)}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
            </svg>
          </button>

          {/* 3. Save Button */}
          <button
            style={getButtonStyle("save", false)}
            onClick={onSave}
            disabled={saving}
            title={saving ? "Saving..." : "Save File"}
            onMouseEnter={() => setHovered("save")}
            onMouseLeave={() => setHovered(null)}
          >
            {saving ? (
              <span style={{ fontSize: "10px" }}>...</span>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
          </button>
        </>
      )}
    </div>
  );
}
