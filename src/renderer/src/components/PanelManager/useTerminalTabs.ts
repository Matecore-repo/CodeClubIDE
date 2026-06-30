import { useState, useCallback, useEffect, useMemo } from "react";
import { type TerminalTab } from "../TerminalPanel";

export function useTerminalTabs({
  workspacePath,
  showTerminal,
  setShowTerminal,
}: {
  workspacePath?: string | null;
  showTerminal: boolean;
  setShowTerminal: (v: boolean) => void;
}) {
  // Persistent terminal tabs state keyed by workspacePath
  const [tabsMap, setTabsMap] = useState<Record<string, TerminalTab[]>>(() => {
    const key = workspacePath ?? "__no_ws__";
    const initialId = Math.random().toString(36).substring(7);
    return { [key]: [{ id: initialId, label: "Terminal 1" }] };
  });
  const [activeTabMap, setActiveTabMap] = useState<Record<string, string>>(() => {
    const key = workspacePath ?? "__no_ws__";
    return { [key]: Object.values(tabsMap)[0]?.[0]?.id ?? "" };
  });

  const wsKey = workspacePath ?? "__no_ws__";

  // Ensure workspace always has at least one tab entry
  const tabs: TerminalTab[] = useMemo(() => {
    if (tabsMap[wsKey]) return tabsMap[wsKey];
    const initialId = Math.random().toString(36).substring(7);
    return [{ id: initialId, label: "Terminal 1" }];
  }, [tabsMap, wsKey]);

  const activeTabId: string = activeTabMap[wsKey] ?? tabs[0]?.id ?? "";

  // Initialise entry when workspacePath changes
  useEffect(() => {
    if (!workspacePath) return;
    const key = workspacePath;
    setTabsMap((prev) => {
      if (prev[key]) return prev;
      const initialId = Math.random().toString(36).substring(7);
      return { ...prev, [key]: [{ id: initialId, label: "Terminal 1" }] };
    });
    setActiveTabMap((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: tabsMap[key]?.[0]?.id ?? "" };
    });
  }, [workspacePath, tabsMap]);

  const handleAddTab = useCallback(
    (profile?: string) => {
      const current = tabsMap[wsKey] ?? [];
      const newId = Math.random().toString(36).substring(7);
      const label = `Terminal ${current.length + 1}`;
      const next = [...current, { id: newId, label, profile }];
      setTabsMap((prev) => ({ ...prev, [wsKey]: next }));
      setActiveTabMap((prev) => ({ ...prev, [wsKey]: newId }));
    },
    [tabsMap, wsKey],
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const current = tabsMap[wsKey] ?? [];
      const next = current.filter((t) => t.id !== tabId);
      if (next.length === 0) {
        setShowTerminal(false);
        const initialId = Math.random().toString(36).substring(7);
        const fresh = [{ id: initialId, label: "Terminal 1" }];
        setTabsMap((prev) => ({ ...prev, [wsKey]: fresh }));
        setActiveTabMap((prev) => ({ ...prev, [wsKey]: initialId }));
      } else {
        setTabsMap((prev) => ({ ...prev, [wsKey]: next }));
        setActiveTabMap((prev) => {
          if (prev[wsKey] === tabId) return { ...prev, [wsKey]: next[next.length - 1].id };
          return prev;
        });
      }
    },
    [tabsMap, wsKey, setShowTerminal],
  );

  const handleSetActiveTab = useCallback(
    (tabId: string) => {
      setActiveTabMap((prev) => ({ ...prev, [wsKey]: tabId }));
    },
    [wsKey],
  );

  useEffect(() => {
    if (!showTerminal || !tabs[0]?.id) return;
    const id = window.setTimeout(() => {
      setActiveTabMap((prev) => ({ ...prev, [wsKey]: tabs[0].id }));
    }, 50);
    return () => window.clearTimeout(id);
  }, [showTerminal, tabs, wsKey]);

  useEffect(() => {
    const onNewTerminal = () => {
      if (!showTerminal) {
        setShowTerminal(true);
      } else {
        handleAddTab();
      }
    };
    const onKillTerminal = () => {
      if (activeTabId) handleCloseTab(activeTabId);
    };
    window.addEventListener("codeclub:new-terminal", onNewTerminal);
    window.addEventListener("codeclub:kill-terminal", onKillTerminal);
    return () => {
      window.removeEventListener("codeclub:new-terminal", onNewTerminal);
      window.removeEventListener("codeclub:kill-terminal", onKillTerminal);
    };
  }, [handleAddTab, handleCloseTab, activeTabId, setShowTerminal, showTerminal]);

  return {
    tabsMap,
    activeTabMap,
    handleAddTab,
    handleCloseTab,
    handleSetActiveTab,
  };
}
