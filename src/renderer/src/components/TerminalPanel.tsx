import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export type TerminalTab = { id: string; label: string; terminalId?: string };

function TerminalInstance({
  cwd,
  sandbox,
  visible,
  onTerminalCreated,
}: {
  cwd: string;
  sandbox?: boolean;
  visible: boolean;
  onTerminalCreated: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termIdRef = useRef<string>("");

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: "#0d0d0d",
        foreground: "#c8c8c8",
        cursor: "#c8c8c8",
        selectionBackground: "#404040",
        black: "#1a1a1a",
        red: "#e57373",
        green: "#81c784",
        yellow: "#ffd54f",
        blue: "#64b5f6",
        magenta: "#ce93d8",
        cyan: "#4dd0e1",
        white: "#c8c8c8",
        brightBlack: "#555555",
        brightRed: "#ef5350",
        brightGreen: "#66bb6a",
        brightYellow: "#ffca28",
        brightBlue: "#42a5f5",
        brightMagenta: "#ab47bc",
        brightCyan: "#26c6da",
        brightWhite: "#ffffff",
      },
      allowTransparency: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    fitRef.current = fit;

    if (containerRef.current) {
      term.open(containerRef.current);
      setTimeout(() => fit.fit(), 50);

      containerRef.current.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          term.clearSelection();
        } else {
          navigator.clipboard
            .readText()
            .then((text) => {
              if (text && termIdRef.current) {
                window.api.writeToTerminal(termIdRef.current, text);
              }
            })
            .catch(() => {});
        }
      });
    }

    term.onData((data) => {
      if (termIdRef.current) window.api.writeToTerminal(termIdRef.current, data);
    });

    term.onKey(({ domEvent }) => {
      if (domEvent.key === "Escape") {
        term.blur();
      }
    });

    term.textarea?.addEventListener("focus", () => {
      window.dispatchEvent(new CustomEvent("codeclub:terminal-focused"));
    });

    term.onResize(({ cols, rows }) => {
      if (termIdRef.current) window.api.resizeTerminal(termIdRef.current, cols, rows);
    });

    termRef.current = term;

    let cleanupData: (() => void) | undefined;
    const mounted = { current: true };

    window.api.createTerminal(cwd, sandbox).then(async (id) => {
      if (!mounted.current) return;
      termIdRef.current = id;
      onTerminalCreated(id);
      const disposeData = window.api.onTerminalData(id, (data) => {
        term.write(data);
      });
      if (!mounted.current) {
        disposeData();
        return;
      }
      const buffer = await window.api.attachTerminal(id);
      if (buffer) term.write(buffer);
      cleanupData = disposeData;
    });

    return () => {
      mounted.current = false;
      cleanupData?.();
      term.dispose();
      if (termIdRef.current) window.api.killTerminal(termIdRef.current);
    };
  }, [cwd, sandbox]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (visible && fitRef.current) {
      setTimeout(() => {
        fitRef.current?.fit();
        termRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (visible) fitRef.current?.fit();
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [visible]);

  return (
    <div
      ref={containerRef}
      style={{
        padding: 4,
        display: visible ? "block" : "none",
        height: "100%",
        width: "100%",
        position: "absolute",
        top: 0,
        left: 0,
      }}
    />
  );
}

export function TerminalPanel({
  cwd,
  sandbox,
  onClose,
  tabs,
  activeTabId,
  onAddTab,
  onCloseTab,
  onSetActiveTab,
}: {
  cwd: string;
  sandbox?: boolean;
  onClose: () => void;
  tabs: TerminalTab[];
  activeTabId: string;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onSetActiveTab: (id: string) => void;
}) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d0d0d" }}
    >
      {/* Tab Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          background: "transparent",
          borderBottom: "1px solid var(--border-weaker-base)",
          gap: 4,
          overflowX: "auto",
          userSelect: "none",
          flexShrink: 0,
          height: 34,
        }}
      >
        {/* Back Button */}
        <button
          onClick={onClose}
          title="Back"
          style={{
            border: "none",
            background: "transparent",
            color: "var(--icon-base)",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-sm)",
            marginRight: 4,
            flexShrink: 0,
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
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSetActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                background: isActive ? "#0d0d0d" : "transparent",
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                border: isActive ? "1px solid #222" : "1px solid transparent",
                borderBottom: isActive ? "1px solid #0d0d0d" : "none",
                marginBottom: -1,
                cursor: "pointer",
                fontSize: 11,
                color: isActive ? "#fff" : "#888",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.label}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                style={{
                  fontSize: 10,
                  opacity: 0.6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                ×
              </span>
            </div>
          );
        })}

        {/* Plus Button */}
        <button
          onClick={onAddTab}
          style={{
            border: "none",
            background: "transparent",
            color: "#888",
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 4,
            marginLeft: 4,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#888";
          }}
        >
          +
        </button>
      </div>

      {/* Terminal Viewport Container */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#0d0d0d" }}>
        {tabs.map((tab) => (
          <TerminalInstance
            key={tab.id}
            cwd={cwd}
            sandbox={sandbox}
            visible={tab.id === activeTabId}
            onTerminalCreated={(termId) => {
              // bubble up via noop — parent state already tracks terminalId if needed
              void termId;
            }}
          />
        ))}
      </div>
    </div>
  );
}
