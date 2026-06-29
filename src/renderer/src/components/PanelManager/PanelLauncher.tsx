import { type LauncherItem } from "./types";

export function getLauncherItems({
  setShowChat,
  setShowTerminal,
  setShowGraph,
  setShowReview,
  _setShowPlan,
  workspacePath,
  chatDisabled = false,
  terminalDisabled = false,
  graphDisabled = false,
  reviewDisabled = false,
  _planDisabled = false,
}: {
  setShowChat: (v: boolean) => void;
  setShowTerminal: (v: boolean) => void;
  setShowGraph: (v: boolean) => void;
  setShowReview?: (v: boolean) => void;
  _setShowPlan?: (v: boolean) => void;
  workspacePath?: string | null;
  chatDisabled?: boolean;
  terminalDisabled?: boolean;
  graphDisabled?: boolean;
  reviewDisabled?: boolean;
  _planDisabled?: boolean;
}): LauncherItem[] {
  return [
    {
      id: "chat",
      label: "Chat",
      disabled: chatDisabled,
      onClick: () => setShowChat(true),
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: "terminal",
      label: "Terminal",
      disabled: terminalDisabled,
      onClick: () => workspacePath && setShowTerminal(true),
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
    },
    {
      id: "graph",
      label: "Graph",
      disabled: graphDisabled,
      onClick: () => workspacePath && setShowGraph(true),
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      ),
    },
    {
      id: "diff",
      label: "Diff",
      disabled: reviewDisabled,
      onClick: () => workspacePath && setShowReview?.(true),
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="12" x2="15" y2="12" />
          <line x1="9" y1="16" x2="13" y2="16" />
        </svg>
      ),
    },
  ];
}

export function PanelLauncher({ items }: { items: LauncherItem[] }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((l) => (
          <button
            key={l.id}
            onClick={l.onClick}
            disabled={l.disabled}
            title={l.label}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 6,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "var(--text-weaker, #555)",
              cursor: l.disabled ? "not-allowed" : "pointer",
              opacity: l.disabled ? 0.3 : 1,
              transition: "background 0.12s, border-color 0.12s, color 0.12s",
              fontSize: 11,
              letterSpacing: "0.04em",
              minWidth: 110,
            }}
            onMouseEnter={(e) => {
              if (l.disabled) return;
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-strong, #ddd)";
            }}
            onMouseLeave={(e) => {
              if (l.disabled) return;
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-weaker, #555)";
            }}
          >
            {l.icon}
            <span>{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
