import { useState, useCallback, useRef } from "react";

export type PanelId = "chat" | "terminal" | "graph" | "debug" | "review" | "file";
export type LayoutMode = "single" | "split2" | "split4";

export function useWorkspaceLayout() {
  const [activePanels, setActivePanels] = useState<PanelId[]>(["chat"]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("single");
  const [terminalBottom, setTerminalBottom] = useState(false);

  const showChat = activePanels.includes("chat");
  const showTerminal = activePanels.includes("terminal");
  const showGraph = activePanels.includes("graph");
  const showReview = activePanels.includes("review");

  const setShowChat = useCallback((show: boolean) => {
    setActivePanels(show ? ["chat"] : []);
  }, []);

  const setShowTerminal = useCallback((show: boolean) => {
    setActivePanels(show ? ["terminal"] : ["chat"]);
  }, []);

  const setShowGraph = useCallback((show: boolean) => {
    setActivePanels(show ? ["graph"] : ["chat"]);
  }, []);

  const setShowReview = useCallback((show: boolean) => {
    setActivePanels(show ? ["review"] : ["chat"]);
  }, []);
  const [splitRatio, setSplitRatio] = useState(0.5); // Ratio between Editor (left/top) and Panels (right/bottom)
  const [panelSplitRatio, setPanelSplitRatio] = useState(0.5); // Ratio between Chat and Terminal
  const [panelOrientation, setPanelOrientation] = useState<"row" | "column">("row");

  const containerRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback(
    (e: MouseEvent, direction: "horizontal" | "vertical", type: "main" | "panel") => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      let ratio = 0.5;
      if (direction === "horizontal") {
        ratio = (e.clientX - rect.left) / rect.width;
      } else {
        ratio = (e.clientY - rect.top) / rect.height;
      }

      ratio = Math.max(0.15, Math.min(0.85, ratio));
      if (type === "main") {
        setSplitRatio(ratio);
      } else {
        setPanelSplitRatio(ratio);
      }
    },
    [],
  );

  return {
    activePanels,
    setActivePanels,
    showTerminal,
    setShowTerminal,
    showGraph,
    setShowGraph,
    showChat,
    setShowChat,
    showReview,
    setShowReview,
    layoutMode,
    setLayoutMode,
    terminalBottom,
    setTerminalBottom,
    splitRatio,
    setSplitRatio,
    panelSplitRatio,
    setPanelSplitRatio,
    panelOrientation,
    setPanelOrientation,
    containerRef,
    handleResize,
  };
}
