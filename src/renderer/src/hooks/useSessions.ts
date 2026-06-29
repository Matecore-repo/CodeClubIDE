import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage } from "./useChat";

const MAX_SESSIONS = 12;

export interface StoredSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
  workspacePath?: string;
}

export function useSessions(
  workspacePath: string | null,
  onSwitchWorkspace?: (path: string) => void,
) {
  const [allSessions, setAllSessions] = useState<StoredSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    window.api.storeGet("ui", "sessions").then((val) => {
      const data = val as { activeSessionId?: string; sessions?: StoredSession[] } | undefined;
      const list = data?.sessions ?? [];
      const active = data?.activeSessionId ?? "";
      setAllSessions(list);
      if (list.length > 0 && list.find((s) => s.id === active)) {
        setActiveSessionId(active);
      }
    });
  }, []);

  useEffect(() => {
    if (!workspacePath) {
      setActiveSessionId("");
      return;
    }
    const currentActive = allSessions.find((s) => s.id === activeSessionId);
    if (currentActive && currentActive.workspacePath === workspacePath) return;

    const firstForWorkspace = allSessions.find((s) => s.workspacePath === workspacePath);
    if (firstForWorkspace) {
      setActiveSessionId(firstForWorkspace.id);
    } else {
      setActiveSessionId("");
    }
  }, [workspacePath, allSessions, activeSessionId]);

  const persistAll = useCallback((list: StoredSession[], activeId: string) => {
    setAllSessions(list);
    setActiveSessionId(activeId);
    window.api.storeSet("ui", "sessions", { activeSessionId: activeId, sessions: list });
  }, []);

  const sessions = workspacePath
    ? allSessions.filter((s) => s.workspacePath === workspacePath)
    : [];

  const activeSession = workspacePath
    ? (allSessions.find((s) => s.id === activeSessionId && s.workspacePath === workspacePath) ??
      null)
    : null;

  const saveMessages = useCallback(
    (msgs: ChatMessage[]) => {
      let targetId = activeSessionId;
      let list = allSessions;
      if (
        (!targetId ||
          !allSessions.find((s) => s.id === targetId && s.workspacePath === workspacePath)) &&
        workspacePath
      ) {
        if (msgs.length === 0) return; // Don't create an empty session immediately
        const root: StoredSession = {
          id: crypto.randomUUID(),
          title: "Session 1",
          createdAt: new Date().toISOString(),
          messages: [],
          workspacePath,
        };
        list = [root, ...allSessions].slice(0, MAX_SESSIONS);
        targetId = root.id;
      }
      const updated = list.map((s) => (s.id === targetId ? { ...s, messages: msgs } : s));
      persistAll(updated, targetId);
    },
    [allSessions, activeSessionId, persistAll, workspacePath],
  );

  const switchSession = useCallback(
    async (id: string) => {
      const target = allSessions.find((s) => s.id === id);
      if (!target) return;
      if (target.workspacePath && target.workspacePath !== workspacePath) {
        try {
          const entries = await window.api.readDir(target.workspacePath);
          if (!entries) throw new Error("no entries");
        } catch {
          const list = allSessions.filter((s) => s.id !== id);
          const active = activeSessionId === id ? (list[0]?.id ?? "") : activeSessionId;
          persistAll(list, active);
          return;
        }
        onSwitchWorkspace?.(target.workspacePath);
      }
      persistAll(allSessions, id);
    },
    [allSessions, activeSessionId, workspacePath, onSwitchWorkspace, persistAll],
  );

  const createSession = useCallback(
    (activate = true) => {
      if (!workspacePath || sessions.length >= MAX_SESSIONS) return;
      const session: StoredSession = {
        id: crypto.randomUUID(),
        title: `Session ${sessions.length + 1}`,
        createdAt: new Date().toISOString(),
        messages: [],
        workspacePath,
      };
      const list = [...allSessions, session];
      persistAll(list, activate ? session.id : activeSessionId);
      return session.id;
    },
    [workspacePath, sessions.length, allSessions, activeSessionId, persistAll],
  );

  const deleteSession = useCallback(
    (id: string) => {
      const list = allSessions.filter((s) => s.id !== id);
      if (list.length === 0) {
        setAllSessions([]);
        setActiveSessionId("");
        window.api.storeSet("ui", "sessions", { activeSessionId: "", sessions: [] });
        return;
      }
      const active = activeSessionId === id ? list[0].id : activeSessionId;
      persistAll(list, active);
    },
    [allSessions, activeSessionId, persistAll],
  );

  const renameSession = useCallback(
    (id: string, title: string) => {
      const updated = allSessions.map((s) => (s.id === id ? { ...s, title } : s));
      persistAll(updated, activeSessionId);
    },
    [allSessions, activeSessionId, persistAll],
  );

  return {
    sessions,
    activeSession,
    activeSessionId,
    allSessions,
    saveMessages,
    switchSession,
    createSession,
    deleteSession,
    renameSession,
  };
}
