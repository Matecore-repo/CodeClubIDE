import { useState, useEffect } from "react";

const styles = {
  titlebar: {
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 0 0 12px",
    background: "#121212",
    borderBottom: "1px solid #202024",
    userSelect: "none" as const,
    WebkitAppRegion: "drag" as unknown as string,
    flexShrink: 0,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    WebkitAppRegion: "no-drag" as unknown as string,
  },
  right: {
    display: "flex",
    alignItems: "center",
    WebkitAppRegion: "no-drag" as unknown as string,
  },
  toolBtn: {
    width: 30,
    height: 30,
    border: "none",
    background: "transparent",
    color: "var(--text-weak)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  title: {
    fontSize: "var(--font-size-small)",
    fontWeight: 500,
    color: "var(--text-strong)",
    letterSpacing: 0,
    marginRight: 4,
  },
  version: {
    fontSize: 10,
    color: "var(--text-weaker)",
    opacity: 0.6,
  },
  updateText: {
    fontSize: 10,
    transition: "color 0.3s ease",
    cursor: "pointer",
    opacity: 0.6,
  },
  winBtn: {
    width: 46,
    height: 36,
    border: "none",
    background: "transparent",
    color: "var(--text-base)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
  },
  closeBtn: {
    width: 46,
    height: 36,
    border: "none",
    background: "transparent",
    color: "var(--text-base)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
  },
};

function MenuDropdown({
  label,
  items,
  openMenu,
  setOpenMenu,
  disabled,
}: {
  label: string;
  items: { label: string; onClick?: () => void }[];
  openMenu: string | null;
  setOpenMenu: (label: string | null) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const isOpen = openMenu === label;

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = () => setOpenMenu(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [isOpen, setOpenMenu]);

  return (
    <div
      style={{ position: "relative", WebkitAppRegion: "no-drag" } as React.CSSProperties}
      onMouseEnter={() => {
        if (!disabled) setHover(true);
      }}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpenMenu(isOpen ? null : label);
        }}
        style={{
          background: hover || isOpen ? "rgba(255, 255, 255, 0.05)" : "transparent",
          border: "none",
          borderRadius: 4,
          color: disabled
            ? "var(--text-weaker)"
            : hover || isOpen
              ? "var(--text-strong)"
              : "var(--text-weak)",
          cursor: disabled ? "default" : "pointer",
          fontSize: 11,
          fontWeight: 400,
          padding: "3px 6px",
          transition: "all 0.15s ease",
          outline: "none",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {label}
      </button>

      {isOpen && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            background: "#121212",
            border: "1px solid #2b2b30",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            padding: "4px 0",
            minWidth: 130,
            zIndex: 9999,
            marginTop: 4,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                item.onClick?.();
                setOpenMenu(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-weak)",
                fontSize: 11,
                padding: "6px 12px",
                textAlign: "left",
                cursor: "pointer",
                width: "100%",
                outline: "none",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.color = "var(--text-strong)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-weak)";
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolButton({
  title,
  onClick,
  children,
  active,
  activeColor,
  disabled = false,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const color = active ? activeColor || "var(--accent-base)" : "var(--text-weak)";
  return (
    <button
      title={title}
      disabled={disabled}
      style={{
        ...styles.toolBtn,
        background: hover ? "var(--surface-base)" : "transparent",
        color,
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onClick={onClick}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </button>
  );
}

function WinButton({
  children,
  onClick,
  isClose,
}: {
  children: React.ReactNode;
  onClick: () => void;
  isClose?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      style={{
        ...(isClose ? styles.closeBtn : styles.winBtn),
        background: hover ? (isClose ? "#e81123" : "var(--surface-base)") : "transparent",
        color: hover && isClose ? "#fff" : "var(--text-base)",
      }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </button>
  );
}

export function Titlebar({
  version,
  activeColor,
  onToggleTerminal,
  onToggleGraph,
  onToggleChat,
  showWorkspaceTools,
  studioMode,
  designMode,
  showChat: _showChat = false,
  showTerminal: _showTerminal = false,
  showGraph: _showGraph = false,
  layoutMode = "single",
  terminalBottom = false,
  showExplorer = true,
  onToggleSidebar,
  onTerminalBottom,
}: {
  version?: string;
  activeColor?: string;
  onToggleTerminal?: () => void;
  onToggleGraph?: () => void;
  onToggleChat?: () => void;
  showWorkspaceTools?: boolean;
  studioMode?: boolean;
  designMode?: boolean;
  showChat?: boolean;
  showTerminal?: boolean;
  showGraph?: boolean;
  layoutMode?: "single" | "split2" | "split4";
  terminalBottom?: boolean;
  showExplorer?: boolean;
  onToggleSidebar?: () => void;
  onTerminalBottom?: () => void;
}) {
  const [maximized, setMaximized] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<
    "initial" | "checking" | "uptodate" | "available" | "downloaded" | "dev"
  >("initial");
  const [_sandbox, _setSandbox] = useState(false);
  const [_isInputVisible, _setIsInputVisible] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [designPage, setDesignPage] = useState<any>(null);
  const [hasStudioSelection, setHasStudioSelection] = useState(false);

  const _accentColor = activeColor || "var(--accent-base)";

  useEffect(() => {
    window.api.windowIsMaximized().then(setMaximized);
    const onResize = () => {
      window.api.windowIsMaximized().then(setMaximized);
    };
    window.addEventListener("resize", onResize);

    const unAvailable = window.api.onUpdateAvailable(() => setUpdateStatus("available"));
    const unNotAvailable = window.api.onUpdateNotAvailable(() => {
      // En desarrollo, el main manda not-available.
      // Si estamos en dev (npm run dev), mostramos Modo desarrollo.
      setUpdateStatus("dev");
    });
    const unDownloaded = window.api.onUpdateDownloaded(() => setUpdateStatus("downloaded"));
    window.api.checkForUpdates();

    return () => {
      window.removeEventListener("resize", onResize);
      unAvailable();
      unNotAvailable();
      unDownloaded();
    };
  }, [version]);

  useEffect(() => {
    const onSandboxState = (e: Event) => {
      _setSandbox((e as CustomEvent).detail);
    };
    const onChatInputState = (e: Event) => {
      _setIsInputVisible((e as CustomEvent).detail);
    };
    const onDesignPage = (e: Event) => {
      setDesignPage((e as CustomEvent).detail);
    };
    const onStudioSelection = (e: Event) => {
      setHasStudioSelection(Boolean((e as CustomEvent).detail));
    };
    window.addEventListener("codeclub:sandbox-state", onSandboxState);
    window.addEventListener("codeclub:chat-input-state", onChatInputState);
    window.addEventListener("codeclub:design-page-state", onDesignPage);
    window.addEventListener("codeclub:studio-selection-state", onStudioSelection);

    // Request current states from Chat component and DesignPane
    window.dispatchEvent(new CustomEvent("codeclub:request-states"));
    window.dispatchEvent(new CustomEvent("codeclub:design-request-page"));

    return () => {
      window.removeEventListener("codeclub:sandbox-state", onSandboxState);
      window.removeEventListener("codeclub:chat-input-state", onChatInputState);
      window.removeEventListener("codeclub:design-page-state", onDesignPage);
      window.removeEventListener("codeclub:studio-selection-state", onStudioSelection);
    };
  }, []);

  useEffect(() => {
    if (!studioMode) setHasStudioSelection(false);
  }, [studioMode]);

  const handleCheckUpdate = () => {
    setUpdateStatus("checking");
    window.api.checkForUpdates();
  };

  const fileItems = [];
  if (studioMode) {
    if (hasStudioSelection) {
      fileItems.push(
        {
          label: "New Row",
          onClick: () => window.dispatchEvent(new CustomEvent("codeclub:studio-add-row")),
        },
        {
          label: "New Column",
          onClick: () => window.dispatchEvent(new CustomEvent("codeclub:studio-add-column")),
        },
      );
    } else {
      fileItems.push(
        {
          label: "New Group",
          onClick: () => window.dispatchEvent(new CustomEvent("codeclub:studio-add-group")),
        },
        { label: "Add Member" },
      );
    }
  } else if (designMode) {
    fileItems.push({
      label: "New Page",
      onClick: () => window.dispatchEvent(new CustomEvent("codeclub:design-add-page")),
    });
    if (designPage) {
      fileItems.push({
        label: "New Layer",
        onClick: () => window.dispatchEvent(new CustomEvent("codeclub:design-add-layer")),
      });
    }
    fileItems.push({
      label: "Import .fig",
      onClick: () => window.dispatchEvent(new CustomEvent("codeclub:design-import-fig")),
    });
    fileItems.push({
      label: "Export .fig",
      onClick: () => window.dispatchEvent(new CustomEvent("codeclub:design-export-fig")),
    });
    fileItems.push({
      label: "Export Code",
      onClick: () => window.dispatchEvent(new CustomEvent("codeclub:design-export-code")),
    });
    fileItems.push({
      label: "Export PNG",
      onClick: () => window.dispatchEvent(new CustomEvent("codeclub:design-export-png")),
    });
  } else if (!designMode) {
    fileItems.push(
      {
        label: "New File",
        onClick: () => window.dispatchEvent(new CustomEvent("codeclub:open-new-file-modal")),
      },
      {
        label: "New Folder",
        onClick: () => window.dispatchEvent(new CustomEvent("codeclub:open-new-folder-modal")),
      },
    );
  }
  fileItems.push({ label: "Exit", onClick: () => window.api.windowClose() });

  const viewItems = [{ label: "Chat", onClick: onToggleChat ?? (() => {}) }];
  if (!studioMode && !designMode) {
    viewItems.push(
      {
        label: "Diff",
        onClick: () => window.dispatchEvent(new CustomEvent("codeclub:toggle-review")),
      },
      { label: "Graph", onClick: onToggleGraph ?? (() => {}) },
      { label: "Terminal", onClick: onToggleTerminal ?? (() => {}) },
    );
  }

  return (
    <div style={styles.titlebar}>
      <div style={styles.left}>
        <span style={styles.title}>Code Club</span>
        <MenuDropdown
          label="File"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          disabled={!showWorkspaceTools}
          items={fileItems}
        />
        <MenuDropdown
          label="View"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          disabled={!showWorkspaceTools}
          items={viewItems}
        />
        <MenuDropdown
          label="Tools"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          disabled={!showWorkspaceTools}
          items={[
            {
              label: "Input",
              onClick: () => window.dispatchEvent(new CustomEvent("codeclub:toggle-chat-input")),
            },
            {
              label: "Sandbox",
              onClick: () => window.dispatchEvent(new CustomEvent("codeclub:toggle-sandbox")),
            },
            {
              label: "Plan & To-do",
              onClick: () => window.dispatchEvent(new CustomEvent("codeclub:toggle-plan")),
            },
          ]}
        />
        {!studioMode && !designMode && (
          <MenuDropdown
            label="Terminal"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            disabled={!showWorkspaceTools}
            items={[
              {
                label: "New Terminal",
                onClick: () => window.dispatchEvent(new CustomEvent("codeclub:new-terminal")),
              },
              {
                label: "Kill Terminal",
                onClick: () => window.dispatchEvent(new CustomEvent("codeclub:kill-terminal")),
              },
            ]}
          />
        )}
        <MenuDropdown
          label="Help"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          items={[
            {
              label: "Documentation",
              onClick: () =>
                window.dispatchEvent(
                  new CustomEvent("codeclub:open-settings", { detail: "privacy" }),
                ),
            },
            { label: "Check for Updates", onClick: handleCheckUpdate },
            {
              label: "About Code Club",
              onClick: () =>
                window.dispatchEvent(
                  new CustomEvent("codeclub:open-settings", { detail: "about" }),
                ),
            },
          ]}
        />
        {updateStatus === "dev" && (
          <MenuDropdown
            label="Developer"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            disabled={!showWorkspaceTools}
            items={[
              {
                label: "Open Settings",
                onClick: () => window.dispatchEvent(new CustomEvent("codeclub:open-settings")),
              },
              {
                label: "Open New File",
                onClick: () =>
                  window.dispatchEvent(new CustomEvent("codeclub:open-new-file-modal")),
              },
              {
                label: "Open New Folder",
                onClick: () =>
                  window.dispatchEvent(new CustomEvent("codeclub:open-new-folder-modal")),
              },
              {
                label: "Open New Column",
                onClick: () => window.dispatchEvent(new CustomEvent("codeclub:studio-add-column")),
              },
              {
                label: "Swarm Menu",
                onClick: () => window.dispatchEvent(new CustomEvent("codeclub:toggle-swarm")),
              },
              {
                label: "Plan & To-do",
                onClick: () => window.dispatchEvent(new CustomEvent("codeclub:toggle-plan")),
              },
              {
                label: "Donation",
                onClick: () =>
                  window.dispatchEvent(new CustomEvent("codeclub:show-donation-banner")),
              },
            ]}
          />
        )}
      </div>

      <div style={{ ...styles.right, gap: 2 }}>
        {/* VSCode-style layout controls */}
        {showWorkspaceTools && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              marginRight: 8,
              paddingRight: 8,
              borderRight: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Toggle sidebar */}
            <ToolButton
              title="Toggle Sidebar"
              onClick={() => onToggleSidebar?.()}
              active={showExplorer}
              activeColor={activeColor}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </ToolButton>
            {/* 1 panel */}
            <ToolButton
              title="Single panel"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("codeclub:layout-panels", { detail: 1 }))
              }
              active={layoutMode === "single"}
              activeColor={activeColor}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </ToolButton>
            {/* 2 panels */}
            <ToolButton
              title="Two panels"
              disabled={terminalBottom || studioMode || designMode}
              onClick={() =>
                window.dispatchEvent(new CustomEvent("codeclub:layout-panels", { detail: 2 }))
              }
              active={layoutMode === "split2"}
              activeColor={activeColor}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                opacity={terminalBottom || studioMode || designMode ? 0.3 : 1}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
            </ToolButton>
            {/* 4 panels */}
            <ToolButton
              title="Four panels"
              disabled={terminalBottom || studioMode || designMode}
              onClick={() =>
                window.dispatchEvent(new CustomEvent("codeclub:layout-panels", { detail: 4 }))
              }
              active={layoutMode === "split4"}
              activeColor={activeColor}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                opacity={terminalBottom || studioMode || designMode ? 0.3 : 1}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
                <line x1="3" y1="12" x2="21" y2="12" />
              </svg>
            </ToolButton>
            {/* Terminal bottom */}
            <ToolButton
              title="Terminal bottom"
              disabled={studioMode || designMode}
              onClick={() => onTerminalBottom?.()}
              active={terminalBottom}
              activeColor={activeColor}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                opacity={studioMode || designMode ? 0.3 : 1}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <polyline points="7 11 9 13 7 15" />
              </svg>
            </ToolButton>
          </div>
        )}
        <WinButton onClick={() => window.api.windowMinimize()}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="0" y="5" width="12" height="1.5" fill="currentColor" />
          </svg>
        </WinButton>
        <WinButton onClick={() => window.api.windowMaximize()}>
          {maximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect
                x="2.5"
                y="0"
                width="9"
                height="9"
                rx="1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <rect
                x="0"
                y="2.5"
                width="9"
                height="9"
                rx="1"
                fill="var(--background-strong)"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect
                x="0"
                y="0"
                width="12"
                height="12"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          )}
        </WinButton>
        <WinButton isClose onClick={() => window.api.windowClose()}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="0" y1="0" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" />
            <line x1="12" y1="0" x2="0" y2="12" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </WinButton>
      </div>
    </div>
  );
}
