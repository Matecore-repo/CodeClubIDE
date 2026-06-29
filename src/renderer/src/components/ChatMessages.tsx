import type { ModelInfo } from "../utils/ai";
import { useEffect, useRef, useState } from "react";
import { Message } from "./ChatMessage";

import { ToolActivitySummary } from "./ChatToolActivity";
import { type UserSettings } from "../utils/userSettings";

const styles = {
  messages: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
};

function BrailleSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const timer = setInterval(() => setFrame((f) => (f + 1) % frames.length), 80);
    return () => clearInterval(timer);
  }, []);
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  return (
    <span
      style={{ fontFamily: "monospace", display: "inline-block", width: 14, textAlign: "center" }}
    >
      {frames[frame]}
    </span>
  );
}

function HomeEmptyState({
  workspacePath,
  userSettings,
  configModel,
  sandbox,
  isSplit = false,
  showTerminal = false,
}: {
  workspacePath?: string | null;
  userSettings?: UserSettings;
  configModel?: string;
  sandbox: boolean;
  isSplit?: boolean;
  showTerminal?: boolean;
}) {
  const emptyStateRef = useRef<HTMLDivElement>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [usage, setUsage] = useState<{ day: string; opens: number; messages: number }[]>([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState<
    { workspacePath: string; lastOpenedAt: string }[]
  >([]);
  const [indexStatus, setIndexStatus] = useState<any | null>(null);

  useEffect(() => {
    window.api
      .readFileBase64("resources/logo no back.png")
      .then((data) => {
        if (data) setLogoSrc(`data:image/png;base64,${data}`);
      })
      .catch(() => setLogoSrc(null));
  }, []);

  useEffect(() => {
    if (!workspacePath) {
      window.api
        .getUsageOverview()
        .then((overview) => {
          setUsage(overview.usage);
          setRecentWorkspaces(overview.recentWorkspaces);
        })
        .catch(() => {
          setUsage([]);
          setRecentWorkspaces([]);
        });
      return;
    }
    window.api
      .getUsageSummary(workspacePath ?? null, 90)
      .then(setUsage)
      .catch(() => setUsage([]));
  }, [workspacePath]);

  useEffect(() => {
    const element = emptyStateRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setIsCompact(entry.contentRect.width <= 740);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!workspacePath) {
      setIndexStatus(null);
      return;
    }
    window.api
      .indexingStatus(workspacePath)
      .then(setIndexStatus)
      .catch(() => setIndexStatus(null));
  }, [workspacePath]);

  const usageCells =
    usage.length === 90
      ? usage
      : Array.from({ length: 90 }, (_, index) => ({ day: String(index), opens: 0, messages: 0 }));

  const usageColor = (opens: number, messages: number) => {
    if (opens === 0 && messages === 0) return "rgba(255,255,255,0.14)";
    if (messages >= 8) return "rgba(255,255,255,0.82)";
    if (messages >= 3) return "rgba(255,255,255,0.58)";
    if (messages >= 1) return "rgba(255,255,255,0.38)";
    return "rgba(255,255,255,0.26)";
  };

  const logoSize = showTerminal ? 64 : 96;
  const translateY = showTerminal ? "0" : "6vh";

  return (
    <div
      ref={emptyStateRef}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: showTerminal ? "center" : "flex-start",
        flexDirection: "column",
        gap: showTerminal ? 12 : 24,
        paddingTop: showTerminal ? 0 : "12vh",
        boxSizing: "border-box",
        transform: `translateY(${translateY})`,
        color: "var(--text-weaker)",
        fontSize: "var(--font-size-small)",
      }}
    >
      <div
        style={{
          width: "min(780px, 80vw)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          flexDirection: isCompact ? "column" : "row",
        }}
      >
        {logoSrc && (
          <img
            src={logoSrc}
            alt="Code Club"
            style={{ width: logoSize, height: logoSize, objectFit: "contain", opacity: 0.8 }}
          />
        )}
        {/* "Just keep coding" removed */}
      </div>
      {!showTerminal && !isCompact && (
        <div
          style={{
            width: isSplit ? "min(280px, 80vw)" : "min(780px, 80vw)",
            display: "flex",
            flexDirection: isSplit ? "column" : "row",
            alignItems: isSplit ? "stretch" : "stretch",
            gap: isSplit ? 0 : 28,
            padding: "18px 20px",
            color: "rgba(255,255,255,0.52)",
            justifyContent: isSplit ? "center" : "stretch",
          }}
        >
          <div style={{ flex: isSplit ? "none" : "0 0 234px", marginBottom: isSplit ? 20 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
              {workspacePath ? "Team usage" : "Workspace usage"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(15, 10px)", gap: 6 }}>
              {usageCells.map((day) => (
                <span
                  key={day.day}
                  title={`${day.day}: ${day.opens} opens, ${day.messages} messages`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: usageColor(day.opens, day.messages),
                  }}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              borderLeft: isSplit ? "none" : "1px solid rgba(255,255,255,0.08)",
              borderTop: isSplit ? "1px solid rgba(255,255,255,0.08)" : "none",
              paddingLeft: isSplit ? 0 : 24,
              paddingTop: isSplit ? 20 : 0,
              paddingBottom: isSplit ? 20 : 0,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 14 }}>AI Config</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>User</span>
                <strong style={{ color: "rgba(255,255,255,0.75)" }}>
                  {userSettings?.username || "You"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Model</span>
                <strong
                  style={{
                    color: "rgba(255,255,255,0.75)",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    maxWidth: isSplit ? 160 : 100,
                  }}
                  title={configModel || "Default"}
                >
                  {configModel || "Default"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Sandbox</span>
                <strong style={{ color: "rgba(255, 255, 255, 0.75)" }}>
                  {sandbox ? "Safe Mode" : "Unsafety"}
                </strong>
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              borderLeft: isSplit ? "none" : "1px solid rgba(255,255,255,0.08)",
              borderTop: isSplit ? "1px solid rgba(255,255,255,0.08)" : "none",
              paddingLeft: isSplit ? 0 : 24,
              paddingTop: isSplit ? 20 : 0,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 14 }}>Indexer</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 11 }}>
              {workspacePath ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Files Indexed</span>
                    <strong style={{ color: "rgba(255,255,255,0.75)" }}>
                      {indexStatus?.totalFiles ?? 0}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Code Chunks</span>
                    <strong style={{ color: "rgba(255,255,255,0.75)" }}>
                      {indexStatus?.totalChunks ?? 0}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Engine</span>
                    <strong style={{ color: "var(--accent-base)" }}>Connected</strong>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Workspaces</span>
                    <strong style={{ color: "rgba(255,255,255,0.75)" }}>
                      {recentWorkspaces.length}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Graph Engine</span>
                    <strong style={{ color: "rgba(255,255,255,0.4)" }}>Standby</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Rust Sidecar</span>
                    <strong style={{ color: "rgba(255,255,255,0.4)" }}>Ready</strong>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatMessages({
  displayMessages,
  loading,
  compacting,
  error,
  plans: _plans,
  planMode: _planMode,
  activeColor,
  sandbox,
  configModel,
  fetchedModels,
  workspacePath,
  regenerate,
  restoreCheckpoint,
  endRef,
  userSettings,
  isSplit = false,
  showTerminal = false,
  isInputVisible = true,
}: {
  displayMessages: any[];
  loading: boolean;
  compacting: boolean;
  error: string | null;
  plans: any[];
  planMode: boolean;
  activeColor?: string;
  sandbox: boolean;
  configModel?: string;
  fetchedModels?: ModelInfo[] | null;
  workspacePath?: string | null;
  regenerate: (id: string) => void;
  restoreCheckpoint?: (id: string) => Promise<void>;
  endRef: React.RefObject<HTMLDivElement | null>;
  userSettings?: UserSettings;
  isSplit?: boolean;
  showTerminal?: boolean;
  isInputVisible?: boolean;
}) {
  return (
    <div
      className="chat-scroll"
      style={{ ...styles.messages, padding: `16px 64px ${isInputVisible ? 160 : 32}px` }}
    >
      {displayMessages.length === 0 && (
        <HomeEmptyState
          workspacePath={workspacePath}
          userSettings={userSettings}
          configModel={configModel}
          sandbox={sandbox}
          isSplit={isSplit}
          showTerminal={showTerminal}
        />
      )}
      {displayMessages.map((item, i) => {
        if (item.type === "tool-activity") {
          return (
            <div key={item.id}>
              {i > 0 && (
                <div
                  style={{
                    height: 0,
                    borderTop: "1px solid var(--border-weaker-base)",
                    margin: "4px 0",
                  }}
                />
              )}
              <ToolActivitySummary
                messages={item.messages}
                showProgress={loading && i === displayMessages.length - 1}
              />
            </div>
          );
        }

        const m = item.message;
        if (
          m.role === "system" &&
          typeof m.content === "string" &&
          m.content.startsWith("[STABLE CONTEXT]")
        ) {
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "16px 0",
                opacity: 0.7,
              }}
            >
              <div style={{ flex: 1, height: 1, background: "var(--border-weaker-base)" }} />
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--text-weaker)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Context Compacted
              </div>
              <div style={{ flex: 1, height: 1, background: "var(--border-weaker-base)" }} />
            </div>
          );
        }

        return (
          <div key={m.id}>
            {i > 0 && (
              <div
                style={{
                  height: 0,
                  borderTop: "1px solid var(--border-weaker-base)",
                  margin: "4px 0",
                }}
              />
            )}
            <Message
              role={m.role}
              content={m.content}
              color={m.role === "user" ? userSettings?.color || activeColor : activeColor}
              userName={m.role === "user" ? userSettings?.username : undefined}
              loading={loading && i === displayMessages.length - 1}
              onRegenerate={m.role === "assistant" ? () => regenerate(m.id) : undefined}
              onRestoreCheckpoint={
                m.role === "user" &&
                m.checkpointId &&
                m.checkpointFilesCaptured &&
                restoreCheckpoint
                  ? () => restoreCheckpoint(m.checkpointId)
                  : undefined
              }
              usage={m.usage}
              model={configModel}
              models={fetchedModels ?? undefined}
              sandbox={sandbox}
              toolName={m.toolName}
            />
          </div>
        );
      })}
      {compacting && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            fontSize: "var(--font-size-small)",
            color: "var(--text-weaker)",
            marginBottom: 4,
          }}
        >
          <BrailleSpinner />
          <span>Compacting context...</span>
        </div>
      )}
      {error && (
        <div
          style={{
            padding: "8px 12px",
            fontSize: "var(--font-size-small)",
            color: "var(--text-on-critical-base)",
            background: "var(--surface-critical-base)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {error}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
