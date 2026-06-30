import { useState, useRef, useEffect, useCallback, useContext, useMemo } from "react";
import type { AIConfig } from "../utils/ai";
import { useChat, type ChatMessage } from "../hooks/useChat";
import { useSessions } from "../hooks/useSessions";
import { useChatWorkspace } from "../hooks/useChatWorkspace";
import { useModelFetching } from "../hooks/useModelFetching";
import { usePanelVisibility } from "../hooks/usePanelVisibility";
import { ActiveColorCtx, SwitchWorkspaceCtx } from "./Layout";
import { PanelManager } from "./PanelManager";
import { ModelSelector } from "./ModelSelector";
import { ChatInput } from "./ChatInput";
import { AskUserModal } from "./AskUserModal";
import { groupToolActivity } from "./ChatToolActivity";
import { type UserSettings } from "../utils/userSettings";
import { SwarmStatus } from "./SwarmStatus";

export function Chat({
  config,
  filePath,
  fileTabs,
  draggedFilePath,
  workspacePath,
  onConfigure,
  onConfigChange,
  onFileSelect,
  onFileDrop,
  onFileTabSelect,
  onFileTabClose,
  onBack,
  showTerminal: propShowTerminal,
  setShowTerminal: propSetShowTerminal,
  showGraph: propShowGraph,
  setShowGraph: propSetShowGraph,
  showChat: propShowChat,
  setShowChat: propSetShowChat,
  showReview: propShowReview,
  setShowReview: propSetShowReview,
  splitRatio,
  handleMainResize,
  studioMode,
  designMode,
  userSettings,
  swarm,
  layoutMode,
  terminalBottom,
  setTerminalBottom,
}: {
  config: AIConfig | null;
  filePath?: string | null;
  fileTabs?: { path: string }[];
  draggedFilePath?: string | null;
  workspacePath?: string | null;
  onConfigure?: () => void;
  onConfigChange?: (c: AIConfig) => void;
  onFileSelect?: (path: string) => void;
  onFileDrop?: () => void;
  onFileTabSelect?: (path: string) => void;
  onFileTabClose?: (path: string) => void;
  onBack?: () => void;
  showTerminal?: boolean;
  setShowTerminal?: (v: boolean) => void;
  showGraph?: boolean;
  setShowGraph?: (v: boolean) => void;
  showChat?: boolean;
  setShowChat?: (v: boolean) => void;
  showReview?: boolean;
  setShowReview?: (v: boolean) => void;
  splitRatio?: number;
  handleMainResize?: (e: React.MouseEvent) => void;
  studioMode?: boolean;
  designMode?: boolean;
  userSettings?: UserSettings;
  swarm?: any;
  layoutMode?: "single" | "split2" | "split4";
  terminalBottom?: boolean;
  setTerminalBottom?: (v: boolean) => void;
}) {
  const activeColor = useContext(ActiveColorCtx);
  const onSwitchWorkspace = useContext(SwitchWorkspaceCtx);

  const {
    sessions,
    activeSession,
    activeSessionId,
    saveMessages,
    switchSession,
    createSession,
    deleteSession,
    renameSession: _renameSession,
  } = useSessions(workspacePath ?? null, onSwitchWorkspace ?? undefined);

  const {
    skills: workspaceSkills,
    fileContext,
    workspaceTree,
    files: workspaceFiles,
  } = useChatWorkspace(workspacePath, filePath);

  useEffect(
    () => () => {
      if (workspacePath) void window.api.debugStop(workspacePath);
    },
    [workspacePath],
  );

  const sessionKey = workspacePath ? `${workspacePath}::${activeSession?.id ?? ""}` : undefined;
  const {
    messages,
    loading,
    compacting,
    error,
    sendMessage,
    stop,
    regenerate,
    restoreCheckpoint,
    sandbox,
    toggleSandbox,
    planMode,
    plans,
    todos,
    pendingQuestion,
    setPendingQuestion,
  } = useChat(
    config,
    fileContext,
    activeSession?.messages,
    sessionKey,
    useCallback(
      (msgs: ChatMessage[]) => {
        saveMessages(msgs);
      },
      [saveMessages],
    ),
    workspacePath ?? undefined,
    workspaceTree,
  );

  const [input, setInput] = useState("");
  const [isInputVisible, setIsInputVisible] = useState(true);
  const [isDesignToolbarVisible, setIsDesignToolbarVisible] = useState(false);
  const [hasDesignSelection, setHasDesignSelection] = useState(false);
  const [chatSubTab, setChatSubTab] = useState<"chat" | "plan">("chat");
  const [hasAnyChatPanel, setHasAnyChatPanel] = useState(false);
  const [isPlanTabVisible, setIsPlanTabVisible] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  const {
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
  } = usePanelVisibility(
    input,
    filePath,
    propShowTerminal,
    propSetShowTerminal,
    propShowGraph,
    propSetShowGraph,
    propShowChat,
    propSetShowChat,
  );

  const showReview = propShowReview;
  const setShowReview = propSetShowReview;

  const { fetchedModels, savedKeys } = useModelFetching(config);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("codeclub:sandbox-state", { detail: sandbox }));
  }, [sandbox]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("codeclub:chat-input-state", { detail: isInputVisible }));
  }, [isInputVisible]);

  useEffect(() => {
    const handleRequest = () => {
      window.dispatchEvent(new CustomEvent("codeclub:sandbox-state", { detail: sandbox }));
      window.dispatchEvent(
        new CustomEvent("codeclub:chat-input-state", { detail: isInputVisible }),
      );
    };
    window.addEventListener("codeclub:request-states", handleRequest);
    return () => {
      window.removeEventListener("codeclub:request-states", handleRequest);
    };
  }, [sandbox, isInputVisible]);

  useEffect(() => {
    const toggleInput = () => {
      if (!workspacePath) return;
      if (designMode) {
        setIsDesignToolbarVisible((show) => !show);
        return;
      }
      setIsInputVisible((show) => !show);
    };
    const togglePlan = () => {
      setIsPlanTabVisible((v) => {
        if (!v) setChatSubTab("plan");
        else setChatSubTab("chat");
        return !v;
      });
    };
    const toggleSandboxEvent = () => toggleSandbox();
    window.addEventListener("codeclub:toggle-chat-input", toggleInput);
    window.addEventListener("codeclub:toggle-plan", togglePlan);
    window.addEventListener("codeclub:toggle-sandbox", toggleSandboxEvent);
    return () => {
      window.removeEventListener("codeclub:toggle-chat-input", toggleInput);
      window.removeEventListener("codeclub:toggle-plan", togglePlan);
      window.removeEventListener("codeclub:toggle-sandbox", toggleSandboxEvent);
    };
  }, [designMode, toggleSandbox, workspacePath]);

  useEffect(() => {
    setIsDesignToolbarVisible(Boolean(designMode));
  }, [designMode]);

  useEffect(() => {
    const onAnyChatPanel = (event: Event) => {
      setHasAnyChatPanel(Boolean((event as CustomEvent).detail));
    };
    window.addEventListener("codeclub:any-chat-panel-state", onAnyChatPanel);
    return () => window.removeEventListener("codeclub:any-chat-panel-state", onAnyChatPanel);
  }, []);

  useEffect(() => {
    if (showChat) setHasAnyChatPanel(true);
  }, [showChat]);

  useEffect(() => {
    const handleSelectionState = (event: Event) => {
      setHasDesignSelection(Boolean((event as CustomEvent).detail));
    };
    window.addEventListener("codeclub:design-selection-state", handleSelectionState);
    return () =>
      window.removeEventListener("codeclub:design-selection-state", handleSelectionState);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          (activeEl instanceof HTMLElement && activeEl.isContentEditable))
      ) {
        return;
      }
      if (designMode && hasDesignSelection && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        return;
      }
      if (e.key === "ArrowDown") {
        if (designMode) setIsDesignToolbarVisible(false);
        else setIsInputVisible(false);
      } else if (e.key === "ArrowUp") {
        if (designMode) setIsDesignToolbarVisible(true);
        else setIsInputVisible(true);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("codeclub:focus-chat-input", { detail: e.key }));
        setIsInputVisible(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [designMode, hasDesignSelection]);

  useEffect(() => {
    const handleDeleteSession = (event: KeyboardEvent) => {
      if (event.key !== "Delete" || !activeSessionId) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") || target?.isContentEditable) return;
      deleteSession(activeSessionId);
    };
    window.addEventListener("keydown", handleDeleteSession);
    return () => window.removeEventListener("keydown", handleDeleteSession);
  }, [activeSessionId, deleteSession]);

  useEffect(() => {
    const handleSessionShortcut = (event: KeyboardEvent) => {
      if (!showChat || !/^F([1-9]|1[0-2])$/.test(event.key)) return;
      const index = Number(event.key.slice(1)) - 1;
      const session = sessions[index];
      if (!session) return;
      event.preventDefault();
      void switchSession(session.id);
    };
    window.addEventListener("keydown", handleSessionShortcut);
    return () => window.removeEventListener("keydown", handleSessionShortcut);
  }, [sessions, showChat, switchSession]);

  useEffect(() => {
    if (!workspacePath) setIsInputVisible(true);
  }, [workspacePath]);

  useEffect(() => {
    if (!studioMode) return;
    setShowTerminal(false);
    setShowGraph(false);
  }, [setShowGraph, setShowTerminal, studioMode]);

  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

  const handleSend = (referenceContext?: string) => {
    const text = input.trim();
    if (!text) return;

    if (pendingQuestion) {
      pendingQuestion.resolve([text]);
      setPendingQuestion(null);
      setInput("");
      return;
    }

    if (loading) return;
    setInput("");
    window.api.logStats({
      type: "message_sent",
      workspacePath: workspacePath ?? null,
      model: config?.model ?? null,
      providerBaseUrl: config?.baseUrl ?? null,
      chars: text.length,
      hasReferences: Boolean(referenceContext),
    });
    sendMessage(referenceContext ? `${text}\n\n${referenceContext}` : text);
  };

  const displayMessages = useMemo(() => groupToolActivity(messages), [messages]);

  const chatInputControls = (
    <div
      style={{
        width: "min(760px, calc(100% - 80px))",
        margin: "0 auto 5vh",
        position: "relative",
        zIndex: 50,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        background: "#111111",
        boxShadow: "0 18px 50px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.04)",
        overflow: "visible",
        transition: "transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.25s ease",
        transform: isInputVisible ? "translateY(0)" : "translateY(150%)",
        opacity: isInputVisible ? 1 : 0,
        pointerEvents: isInputVisible ? "auto" : "none",
      }}
    >
      {swarm && (
        <SwarmStatus
          agents={swarm.agents}
          _onKillAgent={swarm.killAgent}
          onClearAgents={swarm.clearAgents}
        />
      )}
      <ChatInput
        input={input}
        setInput={setInput}
        loading={loading && !pendingQuestion}
        handleSend={handleSend}
        stop={stop}
        apiKey={
          config?.apiKey ||
          (config?.baseUrl?.includes("localhost") ||
          config?.baseUrl?.includes("127.0.0.1") ||
          config?.baseUrl?.includes("opencode.ai")
            ? "public"
            : "")
        }
        onConfigure={onConfigure}
        skills={workspaceSkills}
        workspaceColor={userSettings?.color || activeColor}
        workspacePath={workspacePath}
        workspaceFiles={workspaceFiles}
        caretShape={userSettings?.caretShape}
        onFileSelect={onFileSelect}
        showChat={showChat || hasAnyChatPanel}
        swarm={swarm}
      />
      <ModelSelector
        config={config}
        onConfigChange={onConfigChange}
        fetchedModels={fetchedModels}
        savedKeys={savedKeys}
        isInputVisible={isInputVisible}
        workspacePath={workspacePath}
        sandbox={sandbox}
        toggleSandbox={toggleSandbox}
        activeColor={userSettings?.color || activeColor}
        showChat={showChat}
        setShowChat={setShowChat}
        showTerminal={showTerminal}
        setShowTerminal={setShowTerminal}
        showGraph={showGraph}
        setShowGraph={setShowGraph}
        filePath={filePath}
        studioMode={studioMode}
      />
    </div>
  );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <PanelManager
        filePath={filePath}
        fileTabs={fileTabs}
        draggedFilePath={draggedFilePath}
        showChat={showChat}
        showTerminal={showTerminal}
        showGraph={showGraph}
        showReview={showReview}
        debugProgram={debugProgram}
        splitRatio={splitRatio}
        handleMainResize={handleMainResize}
        onBack={onBack}
        onFileSelect={onFileSelect}
        onFileDrop={onFileDrop}
        onFileTabSelect={onFileTabSelect}
        onFileTabClose={onFileTabClose}
        workspacePath={workspacePath}
        sandbox={sandbox}
        activeColor={activeColor}
        setShowTerminal={setShowTerminal}
        setShowGraph={setShowGraph}
        setShowChat={setShowChat}
        setShowReview={setShowReview}
        showPlan={showPlan}
        setShowPlan={setShowPlan}
        setDebugProgram={setDebugProgram}
        displayMessages={displayMessages}
        loading={loading}
        compacting={compacting}
        error={error}
        plans={plans}
        todos={todos}
        planMode={planMode}
        configModel={config?.model}
        fetchedModels={fetchedModels}
        regenerate={regenerate}
        restoreCheckpoint={restoreCheckpoint}
        endRef={endRef}
        chatInputControls={!studioMode ? chatInputControls : null}
        chatSessionTabs={
          workspacePath ? (
            <>
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
                {sessions.flatMap((session) => {
                  const active = session.id === activeSessionId;
                  const els = [
                    <div
                      key={session.id}
                      onClick={() => {
                        setChatSubTab("chat");
                        void switchSession(session.id);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 12px",
                        border:
                          active && chatSubTab === "chat"
                            ? "1px solid #222"
                            : "1px solid transparent",
                        borderBottom: active && chatSubTab === "chat" ? "1px solid #111" : "none",
                        marginBottom: -1,
                        borderRadius: "4px 4px 0 0",
                        color: active && chatSubTab === "chat" ? "#fff" : "#888",
                        cursor: "pointer",
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      <span>{session.title}</span>
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteSession(session.id);
                        }}
                        title="Close session"
                        style={{ opacity: 0.6, cursor: "pointer" }}
                      >
                        ×
                      </span>
                    </div>,
                  ];
                  if (active && isPlanTabVisible) {
                    const planActive = chatSubTab === "plan";
                    els.push(
                      <div
                        key={`${session.id}-plan`}
                        onClick={() => setChatSubTab("plan")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 12px",
                          border: planActive ? "1px solid #222" : "1px solid transparent",
                          borderBottom: planActive ? "1px solid #111" : "none",
                          marginBottom: -1,
                          borderRadius: "4px 4px 0 0",
                          color: planActive ? "#fff" : "#888",
                          cursor: "pointer",
                          fontSize: 11,
                          flexShrink: 0,
                        }}
                      >
                        <span>Plan & To-do</span>
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsPlanTabVisible(false);
                            setChatSubTab("chat");
                          }}
                          title="Hide Plan"
                          style={{ opacity: 0.6, cursor: "pointer" }}
                        >
                          ×
                        </span>
                      </div>,
                    );
                  }
                  return els;
                })}
                <button
                  onClick={() => createSession()}
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
            </>
          ) : undefined
        }
        chatSessions={sessions.map((session) => ({
          id: session.id,
          title: session.title,
          displayMessages: groupToolActivity(session.messages),
        }))}
        activeChatSessionId={activeSessionId}
        chatSubTab={chatSubTab}
        onCreateChatSession={() => createSession()}
        onDeleteChatSession={deleteSession}
        onSwitchChatSession={(id) => void switchSession(id)}
        studioMode={studioMode}
        designMode={designMode}
        designToolbarVisible={isDesignToolbarVisible}
        userSettings={userSettings}
        layoutMode={layoutMode}
        terminalBottom={terminalBottom}
        setTerminalBottom={setTerminalBottom}
      />
      <AskUserModal
        pendingQuestion={pendingQuestion}
        activeColor={activeColor}
        onResolve={(ans) => {
          pendingQuestion?.resolve(ans);
          setPendingQuestion(null);
        }}
      />
    </div>
  );
}
