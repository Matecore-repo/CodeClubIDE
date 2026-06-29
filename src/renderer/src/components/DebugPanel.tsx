import { useEffect, useState } from "react";
import { loadBreakpoints } from "../utils/debugBreakpoints";

interface Props {
  workspacePath: string;
  program: string;
  onClose: () => void;
}

export function DebugPanel({ workspacePath, program, onClose }: Props) {
  const [status, setStatus] = useState("inactive");
  const [error, setError] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [frames, setFrames] = useState<any[]>([]);
  const [variables, setVariables] = useState<any[]>([]);
  const [threadId, setThreadId] = useState<number>();
  const [watch, setWatch] = useState("");
  const [watchResult, setWatchResult] = useState("");
  const [frameId, setFrameId] = useState<number>();

  const command = async (name: string) => {
    if (!threadId && name !== "pause") return;
    await window.api.debugRequest(workspacePath, name, { threadId });
  };

  useEffect(
    () =>
      window.api.onDebugEvent(workspacePath, async (event) => {
        setStatus(event.event);
        if (event.event === "output")
          setOutput((items) => [...items.slice(-199), event.body?.output ?? ""]);
        if (event.event === "stopped") {
          const id = event.body?.threadId;
          setThreadId(id);
          const stack = await window.api.debugRequest(workspacePath, "stackTrace", {
            threadId: id,
          });
          const nextFrames = stack?.body?.stackFrames ?? [];
          setFrames(nextFrames);
          if (nextFrames[0]) {
            setFrameId(nextFrames[0].id);
            const scopes = await window.api.debugRequest(workspacePath, "scopes", {
              frameId: nextFrames[0].id,
            });
            const refs = scopes?.body?.scopes ?? [];
            const results = await Promise.all(
              refs.map((scope: any) =>
                window.api.debugRequest(workspacePath, "variables", {
                  variablesReference: scope.variablesReference,
                }),
              ),
            );
            setVariables(results.flatMap((result: any) => result?.body?.variables ?? []));
          }
        }
      }),
    [workspacePath],
  );

  const start = async () => {
    setError("");
    setStatus("starting");
    const result = await window.api.debugStart({
      workspacePath,
      program,
      cwd: workspacePath,
      breakpoints: loadBreakpoints(workspacePath),
    });
    if (!result.ok) {
      setStatus("inactive");
      setError(result.error ?? "No se pudo iniciar");
    }
  };

  const evaluateWatch = async () => {
    if (!watch.trim()) return;
    const result = await window.api.debugRequest(workspacePath, "evaluate", {
      expression: watch,
      frameId,
      context: "watch",
    });
    setWatchResult(result?.body?.result ?? result?.message ?? "");
  };

  const stop = async () => {
    await window.api.debugStop(workspacePath);
    setStatus("inactive");
  };

  const button = {
    border: "1px solid #252525",
    background: "#151515",
    color: "#bbb",
    borderRadius: 4,
    cursor: "pointer",
    padding: "4px 10px",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#121212",
        color: "#bbb",
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 5,
          alignItems: "center",
          padding: "6px 10px",
          borderBottom: "1px solid #1a1a1a",
          background: "#121212",
        }}
      >
        <button style={button} onClick={start}>
          Start
        </button>
        <button style={button} onClick={() => void command("continue")}>
          Continue
        </button>
        <button style={button} onClick={() => void command("next")}>
          Step
        </button>
        <button style={button} onClick={() => void command("stepIn")}>
          Into
        </button>
        <button style={button} onClick={() => void command("stepOut")}>
          Out
        </button>
        <button style={button} onClick={stop}>
          Stop
        </button>
        <span style={{ marginLeft: "auto", color: "#777", fontSize: 11 }}>{status}</span>
        <button
          style={{ ...button, padding: 0, width: 24, height: 24, marginLeft: 10 }}
          onClick={onClose}
          title="Close Debugger"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {error && <div style={{ padding: 8, color: "#e57373", whiteSpace: "pre-wrap" }}>{error}</div>}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
        <section
          style={{
            padding: 10,
            overflow: "auto",
            borderRight: "1px solid #1a1a1a",
            background: "#121212",
          }}
        >
          <b>Call stack</b>
          {frames.map((frame) => (
            <div key={frame.id} style={{ padding: "3px 0" }}>
              {frame.name}{" "}
              <span style={{ color: "#777" }}>
                {frame.source?.name}:{frame.line}
              </span>
            </div>
          ))}
        </section>
        <section style={{ padding: 10, overflow: "auto", background: "#121212" }}>
          <b>Variables</b>
          {variables.map((value, index) => (
            <div key={`${value.name}-${index}`}>
              <span style={{ color: "#8ecaff" }}>{value.name}</span> = {value.value}
            </div>
          ))}
          <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
            <input
              value={watch}
              onChange={(event) => setWatch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void evaluateWatch();
              }}
              placeholder="Watch expression"
              style={{
                flex: 1,
                background: "#151515",
                color: "#ddd",
                border: "1px solid #252525",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 11,
                outline: "none",
              }}
            />
            <button style={button} onClick={evaluateWatch}>
              Add
            </button>
          </div>
          {watchResult && <div style={{ paddingTop: 5 }}>{watchResult}</div>}
        </section>
      </div>
      <pre
        style={{
          height: 100,
          overflow: "auto",
          margin: 0,
          padding: 10,
          borderTop: "1px solid #1a1a1a",
          background: "#151515",
          color: "#999",
          fontSize: 11,
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        {output.join("")}
      </pre>
    </div>
  );
}
