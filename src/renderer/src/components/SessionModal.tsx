import { useState, useRef, useEffect, useMemo } from "react";

export interface StoredSession {
  id: string;
  title: string;
  createdAt: string;
  messages: any[];
  workspacePath?: string;
}

export function SessionModal({
  showSessionModal,
  setShowSessionModal,
  sessions,
  activeSessionId,
  switchSession,
  deleteSession,
  createSession,
}: {
  showSessionModal: boolean;
  setShowSessionModal: (show: boolean) => void;
  sessions: StoredSession[];
  activeSessionId?: string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  createSession: () => void;
}) {
  const [sessionSearch, setSessionSearch] = useState("");
  const [activeSessionIdx, setActiveSessionIdx] = useState(0);
  const sessionInputRef = useRef<HTMLInputElement>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);

  const sessionOptions = useMemo(
    () => sessions.map((s) => ({ value: s.id, label: s.title })),
    [sessions],
  );

  const filteredSessions = useMemo(() => {
    return sessionSearch
      ? sessionOptions.filter((s) => s.label.toLowerCase().includes(sessionSearch.toLowerCase()))
      : sessionOptions;
  }, [sessionSearch, sessionOptions]);

  useEffect(() => {
    if (showSessionModal) {
      setSessionSearch("");
      const idx = filteredSessions.findIndex((s) => s.value === activeSessionId);
      setActiveSessionIdx(idx >= 0 ? idx : 0);
      setTimeout(() => sessionInputRef.current?.focus(), 50);
    }
  }, [showSessionModal]);

  useEffect(() => {
    if (showSessionModal) {
      const idx = filteredSessions.findIndex((s) => s.value === activeSessionId);
      setActiveSessionIdx(idx >= 0 ? idx : 0);
    }
  }, [activeSessionId, showSessionModal]);

  useEffect(() => {
    if (sessionListRef.current && sessionListRef.current.children[activeSessionIdx]) {
      const activeEl = sessionListRef.current.children[activeSessionIdx] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeSessionIdx]);

  useEffect(() => {
    if (!showSessionModal) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSessionIdx((prev) =>
          filteredSessions.length > 0 ? (prev + 1) % filteredSessions.length : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSessionIdx((prev) =>
          filteredSessions.length > 0
            ? (prev - 1 + filteredSessions.length) % filteredSessions.length
            : 0,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (
          filteredSessions.length > 0 &&
          activeSessionIdx >= 0 &&
          activeSessionIdx < filteredSessions.length
        ) {
          switchSession(filteredSessions[activeSessionIdx].value);
          setShowSessionModal(false);
        }
      } else if (e.key === "Delete") {
        e.preventDefault();
        if (
          filteredSessions.length > 0 &&
          activeSessionIdx >= 0 &&
          activeSessionIdx < filteredSessions.length
        ) {
          const toDelete = filteredSessions[activeSessionIdx].value;
          deleteSession(toDelete);
          setActiveSessionIdx((prev) => {
            const newLen = filteredSessions.length - 1;
            if (newLen <= 0) return 0;
            return prev >= newLen ? newLen - 1 : prev;
          });
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowSessionModal(false);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    showSessionModal,
    filteredSessions,
    activeSessionIdx,
    switchSession,
    deleteSession,
    setShowSessionModal,
  ]);

  if (!showSessionModal) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "rgba(0,0,0,0.38)",
          backdropFilter: "blur(1px)",
        }}
        onClick={() => setShowSessionModal(false)}
      />
      <div
        tabIndex={0}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "360px",
          maxWidth: "calc(100vw - 32px)",
          background: "#121212",
          border: "1px solid #242428",
          borderRadius: 4,
          boxShadow: "0 14px 32px rgba(0,0,0,0.55)",
          zIndex: 101,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "8px", borderBottom: "1px solid #202024" }}>
          <input
            ref={sessionInputRef}
            value={sessionSearch}
            onChange={(e) => {
              setSessionSearch(e.target.value);
              setActiveSessionIdx(0);
            }}
            placeholder="Search sessions..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "6px 9px",
              borderRadius: 3,
              border: "1px solid #2a2a30",
              background: "#161616",
              color: "var(--text-strong)",
              fontSize: 12,
              outline: "none",
            }}
          />
        </div>
        <div ref={sessionListRef} style={{ overflow: "auto", maxHeight: 220, padding: "4px" }}>
          {filteredSessions.length === 0 ? (
            <div
              style={{
                padding: "14px",
                color: "var(--text-weaker)",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              No sessions found
            </div>
          ) : (
            filteredSessions.map((o, idx) => {
              const isActive = o.value === activeSessionId;
              const isHighlighted = idx === activeSessionIdx;
              return (
                <div
                  key={o.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "5px 7px",
                    borderRadius: 3,
                    background: isHighlighted
                      ? "var(--surface-base)"
                      : isActive
                        ? "#1a1a1a"
                        : "transparent",
                    color: isHighlighted || isActive ? "var(--text-strong)" : "var(--text-base)",
                    fontSize: 12,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={() => setActiveSessionIdx(idx)}
                >
                  <button
                    onClick={() => {
                      switchSession(o.value);
                      setShowSessionModal(false);
                    }}
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      outline: "none",
                    }}
                  >
                    {o.label}
                  </button>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {isActive && (
                      <span
                        style={{
                          fontSize: 10,
                          opacity: 0.65,
                          background: "#1a1a1a",
                          padding: "2px 5px",
                          borderRadius: 2,
                          marginRight: 2,
                        }}
                      >
                        Active
                      </span>
                    )}
                    <button
                      onClick={() => {
                        deleteSession(o.value);
                      }}
                      style={{
                        padding: "3px 5px",
                        border: "none",
                        background: "transparent",
                        color: "var(--text-weaker)",
                        cursor: "pointer",
                        fontSize: 11,
                        lineHeight: 1,
                      }}
                      title="Delete (Del)"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <button
          onClick={() => {
            createSession();
          }}
          style={{
            padding: "8px 12px",
            border: "none",
            borderTop: "1px solid #202024",
            background: "transparent",
            color: "var(--text-weak)",
            fontSize: 12,
            cursor: "pointer",
            textAlign: "left",
            outline: "none",
          }}
        >
          + New session
        </button>
      </div>
    </>
  );
}
