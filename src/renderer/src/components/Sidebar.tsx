import { useState, useEffect } from "react";
import { type UserSettings } from "../utils/userSettings";

const styles = {
  sidebar: {
    width: 44,
    height: "100%",
    background: "#121212",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    borderRight: "1px solid #202024",
    flexShrink: 0,
    overflow: "hidden",
  },
  topSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 10,
    padding: "8px 6px",
    overflow: "auto",
    width: "100%",
  },
  bottomSection: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
    padding: "8px 6px",
    width: "100%",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
    border: "none",
    position: "relative" as const,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "var(--icon-weak-base)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    flexShrink: 0,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "var(--icon-base)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
  },
  divider: {
    width: 22,
    height: 1,
    background: "var(--border-weak-base)",
    margin: "4px 0",
    flexShrink: 0,
  },
};

const sidebarColors = [
  "#ffb08c",
  "#8ecaff",
  "#8bdf9e",
  "#c9a0ff",
  "#ff8a8a",
  "#ffe066",
  "#ff99c8",
  "#7ee8d0",
];

interface Workspace {
  path: string;
  name: string;
}

export function Sidebar({
  onSettingsClick,
  onSelectPath,
  userSettings,
}: {
  onSettingsClick?: () => void;
  onSelectPath?: (path: string, color: string) => void;
  userSettings?: UserSettings;
}) {
  const [active, setActive] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    window.api.storeGet("ui", "workspaces").then(async (val) => {
      if (!val) return;
      const stored = val as Workspace[];
      const validity = await Promise.all(
        stored.map((workspace) => window.api.exists(workspace.path)),
      );
      const valid = stored.filter((_workspace, index) => validity[index]);
      setWorkspaces(valid);
      if (valid.length !== stored.length) await window.api.storeSet("ui", "workspaces", valid);
    });
  }, []);

  const addWorkspace = async () => {
    const folder = await window.api.selectFolder();
    if (!folder) return;
    const name = folder.split("\\").pop() || folder.split("/").pop() || folder;
    if (workspaces.some((w) => w.path === folder)) return;
    const next = [...workspaces, { path: folder, name }];
    setWorkspaces(next);
    window.api.storeSet("ui", "workspaces", next);
  };

  const removeWorkspace = (path: string) => {
    const next = workspaces.filter((w) => w.path !== path);
    setWorkspaces(next);
    window.api.storeSet("ui", "workspaces", next);
    if (active === path) {
      setActive("");
      onSelectPath?.("", sidebarColors[0]);
    }
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.topSection}>
        <button
          style={{
            ...styles.avatar,
            background: active === "" ? "#232326" : "transparent",
            color: active === "" ? "#bdbdc1" : "#71717a",
            border: active === "" ? "none" : "1px solid var(--border-weaker-base)",
          }}
          onClick={() => {
            setActive("");
            onSelectPath?.("", userSettings?.color || sidebarColors[0]);
          }}
          title="Freestyle AI (Local Machine - No Indexing)"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 11 9-8 9 8" />
            <path d="M5 10v10h14V10" />
          </svg>
        </button>

        {workspaces.length > 0 && <div style={styles.divider} />}

        {workspaces.map((ws, i) => {
          const idx = (i + 1) % sidebarColors.length;
          return (
            <button
              key={ws.path}
              style={{
                ...styles.avatar,
                background: active === ws.path ? "#232326" : "transparent",
                color: active === ws.path ? "#bdbdc1" : "#71717a",
                border: active === ws.path ? "none" : "1px solid var(--border-weaker-base)",
              }}
              onClick={() => {
                if (active === ws.path) {
                  onSelectPath?.(ws.path, userSettings?.color || sidebarColors[idx]);
                } else {
                  setActive(ws.path);
                  onSelectPath?.(ws.path, userSettings?.color || sidebarColors[idx]);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                removeWorkspace(ws.path);
              }}
              title={`${ws.name}\n${ws.path}`}
            >
              {ws.name.charAt(0).toUpperCase()}
            </button>
          );
        })}

        <button style={styles.addBtn} title="Add workspace" onClick={addWorkspace}>
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div style={styles.bottomSection}>
        <div style={styles.divider} />
        <button
          style={styles.iconBtn}
          title="Settings"
          onClick={onSettingsClick}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-base)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
