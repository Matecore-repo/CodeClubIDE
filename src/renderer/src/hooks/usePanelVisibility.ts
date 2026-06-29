import { useState, useEffect } from "react";

export function usePanelVisibility(
  input: string,
  filePath?: string | null,
  propShowTerminal?: boolean,
  propSetShowTerminal?: (v: boolean) => void,
  propShowGraph?: boolean,
  propSetShowGraph?: (v: boolean) => void,
  propShowChat?: boolean,
  propSetShowChat?: (v: boolean) => void,
) {
  const [localShowTerminal, localSetShowTerminal] = useState(false);
  const [localShowGraph, localSetShowGraph] = useState(false);
  const [localShowChat, localSetShowChat] = useState(true);
  const [localShowPlan, localSetShowPlan] = useState(false);
  const [debugProgram, setDebugProgram] = useState<string | null>(null);

  const showTerminal = propShowTerminal !== undefined ? propShowTerminal : localShowTerminal;
  const setShowTerminal = propSetShowTerminal || localSetShowTerminal;
  const showGraph = propShowGraph !== undefined ? propShowGraph : localShowGraph;
  const setShowGraph = propSetShowGraph || localSetShowGraph;
  const showChat = propShowChat !== undefined ? propShowChat : localShowChat;
  const setShowChat = propSetShowChat || localSetShowChat;
  const showPlan = localShowPlan;
  const setShowPlan = localSetShowPlan;

  useEffect(() => {
    const open = (event: Event) => {
      const program = (event as CustomEvent<{ program: string }>).detail.program;
      setDebugProgram((prev) => {
        if (prev === program) return null;
        setShowTerminal(false);
        setShowGraph(false);
        return program;
      });
    };
    window.addEventListener("codeclub:debug-open", open);
    return () => window.removeEventListener("codeclub:debug-open", open);
  }, [setShowGraph, setShowTerminal]);

  useEffect(() => {
    const handleTogglePlan = () => setShowPlan((prev) => !prev);
    window.addEventListener("codeclub:toggle-plan", handleTogglePlan);
    return () => window.removeEventListener("codeclub:toggle-plan", handleTogglePlan);
  }, [setShowPlan]);

  return {
    showTerminal,
    setShowTerminal,
    showGraph,
    setShowGraph,
    showChat,
    setShowChat,
    showPlan,
    setShowPlan,
    debugProgram,
    setDebugProgram,
  };
}
