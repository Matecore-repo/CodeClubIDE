import React from "react";
import { TerminalPanel, type TerminalTab } from "../TerminalPanel";

export function TerminalBottom({
  terminalBottom,
  terminalHeight,
  setTerminalHeight,
  workspacePath,
  tabsMap,
  activeTabMap,
  sandbox,
  setTerminalBottom,
  handleAddTab,
  handleCloseTab,
  handleSetActiveTab,
}: {
  terminalBottom: boolean;
  terminalHeight: number;
  setTerminalHeight: (h: number) => void;
  workspacePath?: string | null;
  tabsMap: Record<string, TerminalTab[]>;
  activeTabMap: Record<string, string>;
  sandbox: boolean;
  setTerminalBottom?: (v: boolean) => void;
  handleAddTab: () => void;
  handleCloseTab: (id: string) => void;
  handleSetActiveTab: (id: string) => void;
}) {
  if (!workspacePath) return null;

  return (
    <div
      style={{
        display: terminalBottom ? "flex" : "none",
        flexDirection: "column",
        flexShrink: 0,
        height: terminalHeight,
        minHeight: 120,
        maxHeight: 600,
        borderTop: "1px solid var(--border-weaker-base)",
        position: "relative",
      }}
    >
      {/* Resize handle */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          cursor: "ns-resize",
          zIndex: 10,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startH = terminalHeight;
          const onMove = (ev: MouseEvent) =>
            setTerminalHeight(Math.max(120, Math.min(600, startH + startY - ev.clientY)));
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      />
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
              onClose={() => setTerminalBottom?.(false)}
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
  );
}
