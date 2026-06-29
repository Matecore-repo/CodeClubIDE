import React from "react";
import { StudioView } from "../StudioView";
import { DesignView } from "../DesignView";
import { type PanelManagerProps } from "./types";
import { useTerminalTabs } from "./useTerminalTabs";
import { usePanelDefs } from "./usePanelDefs";
import { getLauncherItems, PanelLauncher } from "./PanelLauncher";
import { TerminalBottom } from "./TerminalBottom";
import { FileViewer } from "../FileViewer";

function BlankPanel() {
  return <div style={{ flex: 1, height: "100%", background: "#111111" }} />;
}

export function PanelManager(props: PanelManagerProps) {
  const {
    workspacePath,
    studioMode,
    designMode,
    designToolbarVisible = false,
    activeColor,
    chatInputControls,
    showReview,
    setShowReview,
    layoutMode = "single",
    terminalBottom = false,
    splitRatio,
    handleMainResize,
    filePath,
  } = props;

  const [terminalHeight, setTerminalHeight] = React.useState(250);
  const [secondaryPanels, setSecondaryPanels] = React.useState<
    ("chat" | "terminal" | "graph" | "review" | "file" | null)[]
  >([null, null, null]);
  const [secondaryFiles, setSecondaryFiles] = React.useState<(string | null)[]>([null, null, null]);
  const [secondaryChatSessions, setSecondaryChatSessions] = React.useState<(string | null)[]>([
    null,
    null,
    null,
  ]);
  const previousPanelCount = React.useRef(
    layoutMode === "split4" ? 4 : layoutMode === "split2" ? 2 : 1,
  );
  const [hasSelectedStudioItem, setHasSelectedStudioItem] = React.useState(false);
  const [studioTableId, setStudioTableId] = React.useState<string | null>(null);
  const [hasSelectedDesignPage, setHasSelectedDesignPage] = React.useState(false);

  React.useEffect(() => {
    const panelCount = layoutMode === "split4" ? 4 : layoutMode === "split2" ? 2 : 1;
    if (panelCount < previousPanelCount.current) {
      setSecondaryPanels([null, null, null]);
      setSecondaryChatSessions([null, null, null]);
      setSecondaryFiles([null, null, null]);
    }
    previousPanelCount.current = panelCount;
  }, [layoutMode]);

  React.useEffect(() => {
    const onToggleReview = () => setShowReview?.(!showReview);
    window.addEventListener("codeclub:toggle-review", onToggleReview);
    return () => window.removeEventListener("codeclub:toggle-review", onToggleReview);
  }, [showReview, setShowReview]);

  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("codeclub:any-chat-panel-state", {
        detail: props.showChat || secondaryPanels.includes("chat"),
      }),
    );
  }, [props.showChat, secondaryPanels]);

  React.useEffect(() => {
    if (!studioMode) {
      setHasSelectedStudioItem(false);
      return;
    }

    const onStudioSelection = (event: Event) => {
      const key = String((event as CustomEvent).detail || "");
      setHasSelectedStudioItem(Boolean(key));
      setStudioTableId(key);
    };

    setHasSelectedStudioItem(false);
    setStudioTableId(null);
    window.addEventListener("codeclub:studio-selection-state", onStudioSelection);
    return () => window.removeEventListener("codeclub:studio-selection-state", onStudioSelection);
  }, [studioMode]);

  React.useEffect(() => {
    if (!designMode) {
      setHasSelectedDesignPage(false);
      return;
    }

    const onDesignPage = (event: Event) => {
      setHasSelectedDesignPage(Boolean((event as CustomEvent).detail));
    };

    setHasSelectedDesignPage(false);
    window.addEventListener("codeclub:design-page-selected", onDesignPage);
    return () => window.removeEventListener("codeclub:design-page-selected", onDesignPage);
  }, [designMode]);

  const terminalTabs = useTerminalTabs({
    workspacePath,
    showTerminal: props.showTerminal,
    setShowTerminal: props.setShowTerminal,
  });

  const { allPanels, visiblePanels } = usePanelDefs({ ...props, ...terminalTabs });

  if (studioMode && workspacePath) {
    return (
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {hasSelectedStudioItem ? (
          <StudioView
            workspacePath={workspacePath}
            activeColor={activeColor}
            tableId={studioTableId ?? undefined}
          />
        ) : (
          <BlankPanel />
        )}
        {chatInputControls && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 80,
              pointerEvents: "none",
            }}
          >
            {chatInputControls}
          </div>
        )}
      </div>
    );
  }

  if (designMode && workspacePath) {
    return hasSelectedDesignPage ? (
      <DesignView toolbarVisible={designToolbarVisible} activeColor={activeColor} />
    ) : (
      <BlankPanel />
    );
  }

  if (visiblePanels.length === 0 && layoutMode === "single") {
    const launchers = getLauncherItems({
      setShowChat: props.setShowChat,
      setShowTerminal: props.setShowTerminal,
      setShowGraph: props.setShowGraph,
      setShowReview: props.setShowReview,
      _setShowPlan: props.setShowPlan,
      workspacePath,
    });

    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          height: "100%",
          position: "relative",
        }}
      >
        {/* Mount terminal hidden to keep PTY alive */}
        <div style={{ display: "none" }}>
          {allPanels.find((p) => p.id === "terminal-panel")?.element}
        </div>

        <PanelLauncher items={launchers} />

        <TerminalBottom
          terminalBottom={terminalBottom}
          terminalHeight={terminalHeight}
          setTerminalHeight={setTerminalHeight}
          workspacePath={workspacePath}
          tabsMap={terminalTabs.tabsMap}
          activeTabMap={terminalTabs.activeTabMap}
          sandbox={props.sandbox}
          setTerminalBottom={props.setTerminalBottom}
          handleAddTab={terminalTabs.handleAddTab}
          handleCloseTab={terminalTabs.handleCloseTab}
          handleSetActiveTab={terminalTabs.handleSetActiveTab}
        />

        {chatInputControls && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 80,
              pointerEvents: "none",
            }}
          >
            {chatInputControls}
          </div>
        )}
      </div>
    );
  }

  // Primary panel content - renders the active panel(s)
  const hasAux = visiblePanels.length > 1;
  const topContent = (
    <div
      style={{ flex: 1, height: "100%", display: "flex", flexDirection: "row", overflow: "hidden" }}
    >
      {/* Keep terminal hidden to preserve PTY */}
      {allPanels.find((p) => p.id === "terminal-panel" && !p.visible) && (
        <div style={{ display: "none" }}>
          {allPanels.find((p) => p.id === "terminal-panel")?.element}
        </div>
      )}
      {visiblePanels.length === 0 ? (
        <PanelLauncher
          items={getLauncherItems({
            setShowChat: props.setShowChat,
            setShowTerminal: props.setShowTerminal,
            setShowGraph: props.setShowGraph,
            setShowReview: props.setShowReview,
            workspacePath,
            chatDisabled: secondaryPanels.includes("chat"),
            terminalDisabled: secondaryPanels.includes("terminal"),
            graphDisabled: secondaryPanels.includes("graph"),
            reviewDisabled: secondaryPanels.includes("review"),
          })}
        />
      ) : (
        visiblePanels.map((panel) => {
          const isFileViewer = panel.id === "file-viewer";
          return (
            <React.Fragment key={panel.id}>
              {!isFileViewer && hasAux && filePath && (
                <div
                  style={{
                    width: 5,
                    cursor: "col-resize",
                    flexShrink: 0,
                    background: "transparent",
                  }}
                  onMouseDown={handleMainResize}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--border-weak-base)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                />
              )}
              <div
                style={{
                  flex: isFileViewer && hasAux ? `0 0 ${(splitRatio ?? 0.5) * 100}%` : 1,
                  minWidth: 0,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  borderRight:
                    isFileViewer && hasAux ? "1px solid var(--border-weak-base)" : "none",
                }}
              >
                {panel.element}
              </div>
            </React.Fragment>
          );
        })
      )}
    </div>
  );

  const renderSplitLayout = () => {
    const secondaryCount = layoutMode === "split4" ? 3 : layoutMode === "split2" ? 1 : 0;
    if (secondaryCount === 0) return topContent;

    const cols = layoutMode === "split4" ? 2 : 2;
    const rows = layoutMode === "split4" ? 2 : 1;

    const renderSecondaryCell = (index: number) => {
      const selected = secondaryPanels[index];
      if (selected) {
        if (selected === "file") {
          const path = secondaryFiles[index];
          return path ? (
            <FileViewer
              filePath={path}
              activeColor={activeColor}
              workspacePath={workspacePath}
              hasOtherPanels
              onBack={() => {
                setSecondaryPanels((current) =>
                  current.map((value, i) => (i === index ? null : value)),
                );
                setSecondaryFiles((current) =>
                  current.map((value, i) => (i === index ? null : value)),
                );
              }}
            />
          ) : null;
        }
        const panelId =
          selected === "chat"
            ? "chat-messages"
            : selected === "terminal"
              ? "terminal-panel"
              : selected === "graph"
                ? "graph-view"
                : "review-panel";
        let element = allPanels.find((panel) => panel.id === panelId)?.element ?? null;
        if (selected === "chat" && React.isValidElement<{ children?: React.ReactNode }>(element)) {
          const sessions = props.chatSessions ?? [];
          const storedSessionId = secondaryChatSessions[index];
          const sessionId = storedSessionId ?? props.activeChatSessionId ?? sessions[0]?.id ?? null;
          const session = sessions.find((item) => item.id === sessionId);
          const children = React.Children.toArray(element.props.children);
          const body = children[1];
          element = React.cloneElement(
            element,
            {},
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                height: 34,
                borderBottom: "1px solid var(--border-weaker-base)",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <button
                title="Back"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--icon-base)",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                }}
              >
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  overflowX: "auto",
                  flex: 1,
                  height: 34,
                }}
              >
                {sessions.map((item) => {
                  const active = item.id === sessionId;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSecondaryChatSessions((current) =>
                          current.map((value, i) => (i === index ? item.id : value)),
                        );
                        props.onSwitchChatSession?.(item.id);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 12px",
                        border: active ? "1px solid #222" : "1px solid transparent",
                        borderBottom: active ? "1px solid #111" : "none",
                        marginBottom: -1,
                        borderRadius: "4px 4px 0 0",
                        color: active ? "#fff" : "#888",
                        cursor: "pointer",
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      <span>{item.title}</span>
                      <span
                        title="Close session"
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onDeleteChatSession?.(item.id);
                        }}
                        style={{ opacity: 0.6 }}
                      >
                        ×
                      </span>
                    </div>
                  );
                })}
                <button
                  onClick={() => {
                    const id = props.onCreateChatSession?.();
                    if (id)
                      setSecondaryChatSessions((current) =>
                        current.map((value, i) => (i === index ? id : value)),
                      );
                  }}
                  title="New session"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#888",
                    cursor: "pointer",
                    fontSize: 16,
                    padding: "2px 6px",
                    flexShrink: 0,
                  }}
                >
                  +
                </button>
              </div>
            </div>,
            React.isValidElement(body)
              ? React.cloneElement(body as React.ReactElement<{ displayMessages: any[] }>, {
                  displayMessages: session?.displayMessages ?? [],
                })
              : body,
          );
        }
        return (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              overflow: "hidden",
              minHeight: 0,
            }}
            onMouseDownCapture={() => {
              if (selected === "chat") {
                const sessionId =
                  secondaryChatSessions[index] ??
                  props.activeChatSessionId ??
                  props.chatSessions?.[0]?.id;
                if (sessionId && sessionId !== props.activeChatSessionId) {
                  props.onSwitchChatSession?.(sessionId);
                }
              }
            }}
            onFocusCapture={() => {
              if (selected === "chat") {
                const sessionId =
                  secondaryChatSessions[index] ??
                  props.activeChatSessionId ??
                  props.chatSessions?.[0]?.id;
                if (sessionId && sessionId !== props.activeChatSessionId) {
                  props.onSwitchChatSession?.(sessionId);
                }
              }
            }}
            onClickCapture={(event) => {
              const button = (event.target as HTMLElement).closest("button");
              if (button?.title !== "Back") return;
              event.stopPropagation();
              setSecondaryPanels((current) =>
                current.map((value, i) => (i === index ? null : value)),
              );
            }}
          >
            {element}
          </div>
        );
      }

      const select = (panel: "chat" | "terminal" | "graph" | "review") => {
        setSecondaryPanels((current) => current.map((value, i) => (i === index ? panel : value)));
      };
      return (
        <PanelLauncher
          items={getLauncherItems({
            setShowChat: () => select("chat"),
            setShowTerminal: () => select("terminal"),
            setShowGraph: () => select("graph"),
            setShowReview: () => select("review"),
            workspacePath,
            chatDisabled:
              props.showChat || secondaryPanels.some((panel, i) => panel === "chat" && i !== index),
            terminalDisabled:
              props.showTerminal ||
              secondaryPanels.some((panel, i) => panel === "terminal" && i !== index),
            graphDisabled:
              props.showGraph ||
              secondaryPanels.some((panel, i) => panel === "graph" && i !== index),
            reviewDisabled:
              !!props.showReview ||
              secondaryPanels.some((panel, i) => panel === "review" && i !== index),
          })}
        />
      );
    };

    const cells = [
      topContent,
      ...Array.from({ length: secondaryCount }, (_, i) => (
        <React.Fragment key={i}>{renderSecondaryCell(i)}</React.Fragment>
      )),
    ];

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          overflow: "hidden",
        }}
      >
        {cells.map((cell, i) => {
          const empty = i === 0 ? visiblePanels.length === 0 : secondaryPanels[i - 1] === null;
          const fileIsOpen = (path: string) => path === filePath || secondaryFiles.includes(path);
          return (
            <div
              key={i}
              onDragOver={(event) => {
                const path = event.dataTransfer.getData("application/x-codeclub-file");
                if (
                  empty &&
                  !fileIsOpen(path) &&
                  event.dataTransfer.types.includes("application/x-codeclub-file")
                )
                  event.preventDefault();
              }}
              onDrop={(event) => {
                if (!empty) return;
                const path = event.dataTransfer.getData("application/x-codeclub-file");
                if (!path || fileIsOpen(path)) return;
                event.preventDefault();
                if (i === 0) props.onFileSelect?.(path);
                else {
                  const index = i - 1;
                  setSecondaryFiles((current) =>
                    current.map((value, slot) => (slot === index ? path : value)),
                  );
                  setSecondaryPanels((current) =>
                    current.map((value, slot) => (slot === index ? "file" : value)),
                  );
                }
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRight: i % cols !== cols - 1 ? "1px solid var(--border-weaker-base)" : "none",
                borderBottom: i < cols ? "none" : "1px solid var(--border-weaker-base)",
              }}
            >
              {cell}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
        position: "relative",
        background: "#111111",
      }}
    >
      {/* Main panels area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {renderSplitLayout()}
      </div>

      <TerminalBottom
        terminalBottom={terminalBottom}
        terminalHeight={terminalHeight}
        setTerminalHeight={setTerminalHeight}
        workspacePath={workspacePath}
        tabsMap={terminalTabs.tabsMap}
        activeTabMap={terminalTabs.activeTabMap}
        sandbox={props.sandbox}
        setTerminalBottom={props.setTerminalBottom}
        handleAddTab={terminalTabs.handleAddTab}
        handleCloseTab={terminalTabs.handleCloseTab}
        handleSetActiveTab={terminalTabs.handleSetActiveTab}
      />

      {chatInputControls && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 80,
            pointerEvents: "none",
          }}
        >
          {chatInputControls}
        </div>
      )}
    </div>
  );
}
