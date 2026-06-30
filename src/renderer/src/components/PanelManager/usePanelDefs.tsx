import React from "react";
import { FileViewer } from "../FileViewer";
import { ChatMessages } from "../ChatMessages";
import { GraphView } from "../GraphView";
import { DebugPanel } from "../DebugPanel";
import { ReviewPanel } from "../ReviewPanel";
import { PlanPanel } from "../PlanPanel";
import { TerminalPanel, type TerminalTab } from "../TerminalPanel";
import { type PanelManagerProps } from "./types";

function FileTabsPanel({
  tabs,
  activePath,
  activeColor,
  onBack,
  workspacePath,
  hasOtherPanels,
  onSelectTab,
  onCloseTab,
}: {
  tabs: { path: string }[];
  activePath: string;
  activeColor?: string;
  onBack: () => void;
  workspacePath?: string | null;
  hasOtherPanels: boolean;
  onSelectTab?: (path: string) => void;
  onCloseTab?: (path: string) => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {tabs.map((tab) => (
        <div
          key={tab.path}
          style={{
            display: tab.path === activePath ? "flex" : "none",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <FileViewer
            filePath={tab.path}
            isActive={tab.path === activePath}
            activeColor={activeColor}
            onBack={onBack}
            workspacePath={workspacePath}
            hasOtherPanels={hasOtherPanels}
            tabs={tabs}
            activePath={activePath}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
          />
        </div>
      ))}
    </div>
  );
}

export function usePanelDefs(
  props: PanelManagerProps & {
    tabsMap: Record<string, TerminalTab[]>;
    activeTabMap: Record<string, string>;
    handleAddTab: () => void;
    handleCloseTab: (id: string) => void;
    handleSetActiveTab: (id: string) => void;
  },
) {
  const {
    filePath,
    fileTabs = [],
    showChat,
    showTerminal,
    showGraph,
    showReview,
    debugProgram,
    onBack,
    onFileSelect,
    workspacePath,
    sandbox,
    activeColor,
    setShowTerminal,
    setShowGraph,
    setShowReview,
    setDebugProgram,
    displayMessages,
    loading,
    compacting,
    error,
    plans,
    todos,
    planMode,
    chatSessionTabs,
    chatSubTab,
    configModel,
    fetchedModels,
    regenerate,
    restoreCheckpoint,
    endRef,
    userSettings,
    tabsMap,
    activeTabMap,
    handleAddTab,
    handleCloseTab,
    handleSetActiveTab,
  } = props;

  const graphOnClose = React.useCallback(() => setShowGraph(false), [setShowGraph]);
  const graphOnNodeClick = React.useCallback(
    (path: string) => {
      setShowGraph(false);
      onFileSelect?.(path);
    },
    [setShowGraph, onFileSelect],
  );

  const hasOtherPanels =
    showChat || showGraph || !!debugProgram || !!showReview || showTerminal || !!props.showPlan;
  const activeFilePath = filePath ?? fileTabs[0]?.path ?? null;

  const allPanels = [
    {
      id: "file-viewer",
      visible: fileTabs.length > 0 && !!activeFilePath,
      element: fileTabs.length > 0 && activeFilePath ? (
        <FileTabsPanel
          tabs={fileTabs}
          activePath={activeFilePath}
          activeColor={activeColor}
          onBack={onBack ?? (() => {})}
          workspacePath={workspacePath}
          hasOtherPanels={hasOtherPanels}
          onSelectTab={props.onFileTabSelect}
          onCloseTab={props.onFileTabClose}
        />
      ) : null,
    },
    {
      id: "chat-messages",
      visible: showChat,
      element: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
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
              onClick={onBack}
              title="Back"
              style={{
                border: "none",
                background: "transparent",
                color: "var(--icon-base)",
                cursor: "pointer",
                padding: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--radius-sm)",
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
            {chatSessionTabs}
          </div>
          {chatSubTab === "plan" ? (
            <PlanPanel plans={plans} todos={todos} />
          ) : (
            <ChatMessages
              displayMessages={displayMessages}
              loading={loading}
              compacting={compacting}
              error={error}
              plans={plans}
              planMode={planMode}
              activeColor={activeColor}
              sandbox={sandbox}
              configModel={configModel}
              fetchedModels={fetchedModels}
              workspacePath={workspacePath}
              regenerate={regenerate}
              restoreCheckpoint={restoreCheckpoint}
              endRef={endRef}
              userSettings={userSettings}
              isSplit={Boolean(fileTabs.length || showGraph || debugProgram || showTerminal)}
              showTerminal={showTerminal}
            />
          )}
        </div>
      ),
    },
    {
      id: "graph-view",
      visible: showGraph && !!workspacePath,
      element: workspacePath ? (
        <GraphView
          workspacePath={workspacePath}
          activeColor={activeColor}
          onClose={graphOnClose}
          onNodeClick={graphOnNodeClick}
        />
      ) : null,
    },
    {
      id: "debug-panel",
      visible: !!debugProgram && !!workspacePath,
      element:
        debugProgram && workspacePath ? (
          <DebugPanel
            workspacePath={workspacePath}
            program={debugProgram}
            onClose={() => setDebugProgram(null)}
          />
        ) : null,
    },
    {
      id: "review-panel",
      visible: !!showReview && !!workspacePath,
      element: workspacePath ? (
        <ReviewPanel
          workspacePath={workspacePath}
          displayMessages={displayMessages}
          onClose={() => setShowReview?.(false)}
        />
      ) : null,
    },
    {
      id: "terminal-panel",
      visible: showTerminal && !!workspacePath,
      element: workspacePath ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {Object.entries(tabsMap).map(([ws, wsTabs]) => {
            if (ws === "__no_ws__") return null;
            return (
              <div
                key={ws}
                style={{
                  display: workspacePath === ws ? "flex" : "none",
                  flex: 1,
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <TerminalPanel
                  cwd={ws}
                  sandbox={sandbox}
                  onClose={() => setShowTerminal(false)}
                  tabs={wsTabs}
                  activeTabId={activeTabMap[ws]}
                  onAddTab={handleAddTab}
                  onCloseTab={handleCloseTab}
                  onSetActiveTab={handleSetActiveTab}
                />
              </div>
            );
          })}
        </div>
      ) : null,
    },
  ];

  return { allPanels, visiblePanels: allPanels.filter((p) => p.visible) };
}
