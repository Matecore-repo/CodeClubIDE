import {
  useState,
  useCallback,
  useEffect,
  createContext,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import { Titlebar } from "./Titlebar";
import { Sidebar } from "./Sidebar";
import { FileExplorer } from "./FileExplorer";
import { useWorkspaceLayout } from "../hooks/useWorkspaceLayout";
import { loader } from "@monaco-editor/react";
import { type UserSettings } from "../utils/userSettings";
import { DonationBanner } from "./DonationBanner";

export const ActiveColorCtx = createContext("");
export const SwitchWorkspaceCtx = createContext<((path: string) => void) | null>(null);

const styles = {
  shell: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    background: "var(--background-base)",
  },
  body: {
    flex: 1,
    display: "flex",
    minHeight: 0,
    overflow: "hidden",
  },
  rightPane: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    minWidth: 0,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    position: "relative" as const,
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    padding: 0,
  },
  filePane: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    minHeight: 0,
    borderBottom: "1px solid var(--border-weak-base)",
  },
  chatPane: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    minHeight: 0,
  },
};

const MAX_FILE_TABS = 12;

export function Layout({
  children,
  version,
  onSettingsClick,
  userSettings,
  swarm,
}: {
  children: ReactNode;
  version?: string;
  onSettingsClick?: () => void;
  userSettings?: UserSettings;
  swarm?: any;
}) {
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState("");
  const [showExplorer, setShowExplorer] = useState(true);
  const [explorerMode, setExplorerMode] = useState<"folders" | "studio" | "design">("folders");
  const [fileTabs, setFileTabs] = useState<{ path: string }[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [draggedFilePath, setDraggedFilePath] = useState<string | null>(null);

  useEffect(() => {
    if (userSettings?.color && activeColor) {
      setActiveColor(userSettings.color);
    }
  }, [userSettings?.color, activeColor]);
  const [explorerWidth, setExplorerWidth] = useState(() => {
    if (typeof window === "undefined") return 220;
    return Math.round(Math.max(220, Math.min(320, window.innerWidth * 0.16)));
  });
  const layout = useWorkspaceLayout();
  const { setActivePanels, setLayoutMode, setSplitRatio } = layout;

  const _isEditorActive = !!activeFilePath;

  const handleMainResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const rect = layout.containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = (ev.clientX - rect.left) / rect.width;

      if (ratio < 0.2) {
        if (fileTabs.length) {
          setFileTabs([]);
          setActiveFilePath(null);
        } else layout.setShowChat(false);
        return;
      }
      if (ratio > 0.8) {
        if (layout.showTerminal) layout.setShowTerminal(false);
        else if (layout.showGraph) layout.setShowGraph(false);
        else layout.setShowChat(false);
        return;
      }
      layout.setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const _handlePanelResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      layout.handleResize(ev, "horizontal", "panel");
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleSelectPath = useCallback(
    (path: string, color: string) => {
      if (activePath === path) {
        setShowExplorer((prev) => !prev);
      } else {
        setActivePath(path || null);
        setActiveColor(path ? color : "");
        setFileTabs([]);
        setActiveFilePath(null);
        setDraggedFilePath(null);
        setShowExplorer(true);
      }
    },
    [activePath],
  );

  useEffect(() => {
    if (activePath) {
      window.api.logStats({ type: "workspace_open", workspacePath: activePath });
      window.api.indexingOpen(activePath);
      setExplorerMode("folders");

      const warmMonaco = () => {
        void loader.init();
      };
      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(warmMonaco, { timeout: 1500 });
        return () => window.cancelIdleCallback(id);
      }
      const id = globalThis.setTimeout(warmMonaco, 250);
      return () => globalThis.clearTimeout(id);
    } else {
      setExplorerMode("folders");
      window.api.indexingClose();
    }
  }, [activePath]); // intentionally omitting layout setters to run only once per workspace open

  useEffect(() => {
    const onLayoutPanels = (e: Event) => {
      const count = (e as CustomEvent).detail as number;
      if (count === 1) setLayoutMode("single");
      else if (count === 2) setLayoutMode("split2");
      else if (count === 4) setLayoutMode("split4");
    };
    window.addEventListener("codeclub:layout-panels", onLayoutPanels);
    return () => window.removeEventListener("codeclub:layout-panels", onLayoutPanels);
  }, [setLayoutMode]);

  const handleSwitchWorkspace = useCallback((path: string) => {
    setActivePath(path);
    setActiveColor("");
    setFileTabs([]);
    setActiveFilePath(null);
    setDraggedFilePath(null);
  }, []);

  const openPanel = useCallback(
    (panel: "chat" | "terminal" | "graph" | "file" | "review" | "debug", path?: string) => {
      if (panel === "file" && path) {
        setFileTabs((current) => {
          if (current.some((tab) => tab.path === path)) return current;
          if (!current.length || !activeFilePath) return [{ path }];
          if (!current.some((tab) => tab.path === activeFilePath)) return [{ path }];
          return current.map((tab) => (tab.path === activeFilePath ? { path } : tab));
        });
        setActiveFilePath(path);
        setActivePanels(["file"]);
      } else {
        setFileTabs([]);
        setActiveFilePath(null);
        setActivePanels([panel as any]);
      }
    },
    [activeFilePath, setActivePanels],
  );

  const handleFileSelect = useCallback(
    (path: string) => {
      if (explorerMode === "studio") return;
      openPanel("file", path);
    },
    [explorerMode, openPanel],
  );

  const openDraggedFileAsTab = useCallback(
    () => {
      const path = draggedFilePath;
      if (!path) return;
      if (explorerMode === "studio") return;
      setFileTabs((current) => {
        if (current.some((tab) => tab.path === path)) return current;
        if (current.length >= MAX_FILE_TABS) return current;
        return [...current, { path }];
      });
      setActiveFilePath((current) => {
        if (fileTabs.length >= MAX_FILE_TABS && !fileTabs.some((tab) => tab.path === path)) {
          return current;
        }
        return path;
      });
      setActivePanels(["file"]);
    },
    [draggedFilePath, explorerMode, fileTabs, setActivePanels],
  );

  const handleFileTabClose = useCallback(
    (path: string) => {
      setFileTabs((current) => {
        const index = current.findIndex((tab) => tab.path === path);
        const next = current.filter((tab) => tab.path !== path);
        if (activeFilePath === path) {
          const fallback = next[index] ?? next[index - 1] ?? null;
          setActiveFilePath(fallback?.path ?? null);
          if (!fallback) setActivePanels([]);
        }
        return next;
      });
    },
    [activeFilePath, setActivePanels],
  );

  const handleFileTabSelect = useCallback(
    (path: string) => {
      if (fileTabs.some((tab) => tab.path === path)) setActiveFilePath(path);
    },
    [fileTabs],
  );

  useEffect(() => {
    const handleFileTabHotkeys = (event: KeyboardEvent) => {
      if (!/^F([1-9]|1[0-2])$/.test(event.key)) return;
      const index = Number(event.key.slice(1)) - 1;
      const tab = fileTabs[index];
      if (!tab) return;
      event.preventDefault();
      event.stopPropagation();
      setActiveFilePath(tab.path);
      setActivePanels(["file"]);
    };

    window.addEventListener("keydown", handleFileTabHotkeys, true);
    return () => window.removeEventListener("keydown", handleFileTabHotkeys, true);
  }, [fileTabs, setActivePanels]);

  const handleExplorerModeChange = useCallback(
    (mode: "folders" | "studio" | "design") => {
      setExplorerMode(mode);
      if (activePath) {
        // Merge mode into existing config to preserve tables array
        window.api
          .readStudioConfig(activePath)
          .then((existing: any) => {
            window.api.writeStudioConfig(activePath, { ...existing, mode }).catch(() => {});
          })
          .catch(() => {
            window.api.writeStudioConfig(activePath, { mode }).catch(() => {});
          });
      }
      if (mode !== "folders") {
        setFileTabs([]);
        setActiveFilePath(null);
        setDraggedFilePath(null);
        layout.setLayoutMode("single");
        layout.setShowTerminal(false);
        layout.setTerminalBottom(false);
        setActivePanels([]);
        setSplitRatio(0.5);
      }
    },
    [setSplitRatio, setActivePanels, activePath, layout],
  );

  const handleBack = useCallback(() => {
    if (layout.layoutMode !== "single") {
      // In multi-panel mode, back goes to launcher (empty)
      setFileTabs([]);
      setActiveFilePath(null);
      setActivePanels([]);
    } else {
      openPanel("chat");
    }
  }, [openPanel, setActivePanels, layout.layoutMode]);

  const setShowChat = useCallback(
    (show: boolean) => {
      if (show) openPanel("chat");
      else setActivePanels([]);
    },
    [openPanel, setActivePanels],
  );

  const setShowTerminal = useCallback(
    (show: boolean) => {
      if (show && explorerMode === "studio") return;
      if (show) openPanel("terminal");
      else setActivePanels(["chat"]);
    },
    [explorerMode, openPanel, setActivePanels],
  );

  const setShowGraph = useCallback(
    (show: boolean) => {
      if (show && explorerMode === "studio") return;
      if (show) openPanel("graph");
      else setActivePanels(["chat"]);
    },
    [explorerMode, openPanel, setActivePanels],
  );

  const setShowReview = useCallback(
    (show: boolean) => {
      if (show && explorerMode === "studio") return;
      if (show) openPanel("review");
      else setActivePanels(["chat"]);
    },
    [explorerMode, openPanel, setActivePanels],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = explorerWidth;

      const onMove = (ev: MouseEvent) => {
        const newW = Math.max(160, Math.min(500, startW + ev.clientX - startX));
        setExplorerWidth(newW);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [explorerWidth],
  );

  return (
    <div style={styles.shell}>
      <Titlebar
        version={version}
        activeColor={activeColor}
        onToggleTerminal={() => setShowTerminal(!layout.showTerminal)}
        onToggleGraph={() => setShowGraph(!layout.showGraph)}
        onToggleChat={() => setShowChat(!layout.showChat)}
        showWorkspaceTools={!!activePath}
        studioMode={explorerMode === "studio"}
        designMode={explorerMode === "design"}
        showChat={layout.showChat}
        showTerminal={layout.showTerminal}
        showGraph={layout.showGraph}
        layoutMode={layout.layoutMode}
        terminalBottom={layout.terminalBottom}
        showExplorer={showExplorer}
        onToggleSidebar={() => setShowExplorer((v) => !v)}
        onTerminalBottom={() => {
          const enabled = !layout.terminalBottom;
          if (enabled) layout.setLayoutMode("single");
          layout.setTerminalBottom(enabled);
        }}
      />
      <DonationBanner />
      <div style={styles.body}>
        <Sidebar
          onSettingsClick={onSettingsClick}
          onSelectPath={handleSelectPath}
          userSettings={userSettings}
        />
        {activePath && showExplorer && (
          <div style={{ display: "flex", position: "relative" as const }}>
            <div style={{ width: explorerWidth, flexShrink: 0 }}>
              <FileExplorer
                rootPath={activePath}
                onFileSelect={handleFileSelect}
                onFileDragStart={setDraggedFilePath}
                onFileDragEnd={() => setDraggedFilePath(null)}
                mode={explorerMode}
                onModeChange={handleExplorerModeChange}
                activeColor={activeColor}
              />
            </div>
            <div
              style={{
                width: 4,
                cursor: "col-resize",
                flexShrink: 0,
                background: "transparent",
                position: "relative" as const,
                zIndex: 10,
              }}
              onMouseDown={handleMouseDown}
            />
          </div>
        )}
        <div style={styles.rightPane}>
          <div style={styles.content}>
            <ActiveColorCtx.Provider value={activeColor}>
              <SwitchWorkspaceCtx.Provider value={handleSwitchWorkspace}>
                <div ref={layout.containerRef} style={styles.main}>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      overflow: "hidden",
                      minWidth: 200,
                      flexDirection: "row",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        minHeight: 0,
                      }}
                    >
                      {Children.map(children, (child) =>
                        isValidElement(child)
                          ? cloneElement(child as React.ReactElement<any>, {
                              filePath: activeFilePath,
                              fileTabs,
                              draggedFilePath,
                              onBack: handleBack,
                              splitRatio: layout.splitRatio,
                              handleMainResize: handleMainResize,
                              workspacePath: activePath,
                              onFileSelect: handleFileSelect,
                              onFileDrop: openDraggedFileAsTab,
                              onFileTabSelect: handleFileTabSelect,
                              onFileTabClose: handleFileTabClose,
                              showTerminal: layout.showTerminal,
                              setShowTerminal,
                              showGraph: layout.showGraph,
                              setShowGraph,
                              showChat: layout.showChat,
                              setShowChat,
                              showReview: layout.showReview,
                              setShowReview,
                              layoutMode: layout.layoutMode,
                              terminalBottom: layout.terminalBottom,
                              setTerminalBottom: layout.setTerminalBottom,
                              studioMode: explorerMode === "studio",
                              designMode: explorerMode === "design",
                              swarm,
                            })
                          : child,
                      )}
                    </div>
                  </div>
                </div>
              </SwitchWorkspaceCtx.Provider>
            </ActiveColorCtx.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}
