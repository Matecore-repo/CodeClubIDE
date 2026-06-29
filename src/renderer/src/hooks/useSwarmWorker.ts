import { useEffect, useState, useRef, useCallback } from "react";
import type { AIConfig } from "../utils/ai";
import { streamCompletion, executeRegisteredTool, builtInTools } from "../utils/ai";

const STREAM_IDLE_TIMEOUT_MS = 180_000;

export interface SwarmAgentStatus {
  id: string;
  role: string;
  status: "idle" | "running" | "tool" | "done" | "error";
  currentTool?: string;
  lastMessage?: string;
  resultChars?: number;
  toolCount?: number;
  debugLog?: string;
}

export function useSwarmWorker(config: AIConfig | null) {
  const [port, setPort] = useState<number | null>(null);
  const [agents, setAgents] = useState<SwarmAgentStatus[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const activeTasks = useRef<Set<string>>(new Set());
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    window.api
      .swarmPort()
      .then(setPort)
      .catch(() => {});
  }, []);

  const broadcastStatus = useCallback(
    (agentId: string, status: Partial<SwarmAgentStatus> & { appendLog?: string }) => {
      setAgents((prev) => {
        const idx = prev.findIndex((a) => a.id === agentId);
        if (idx === -1) return prev;
        const next = [...prev];
        let newLog = next[idx].debugLog || "";
        if (status.appendLog) {
          newLog += status.appendLog;
        }
        const updated = { ...next[idx], ...status, debugLog: newLog };
        delete (updated as any).appendLog;
        next[idx] = updated;
        return next;
      });

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const payload = { id: agentId, ...status };
        delete (payload as any).appendLog;
        delete (payload as any).debugLog;
        wsRef.current.send(
          JSON.stringify({
            type: "agent_update",
            payload,
          }),
        );
      }
    },
    [],
  );

  const runAgent = useCallback(
    async (
      agentId: string,
      role: string,
      prompt: string,
      workspacePath?: string,
      excludeTools?: string[],
    ) => {
      if (!config) {
        broadcastStatus(agentId, { status: "error", lastMessage: "API config missing" });
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "agent_done",
              payload: {
                id: agentId,
                result: [{ role: "assistant", content: "Error: API config missing." }],
              },
            }),
          );
        }
        return;
      }

      activeTasks.current.add(agentId);
      const agentAbort = new AbortController();
      abortControllers.current.set(agentId, agentAbort);

      broadcastStatus(agentId, {
        status: "running",
        lastMessage: "Iniciando...",
        resultChars: 0,
        toolCount: 0,
        debugLog: `=== INIT [${role}] ===\nPrompt: ${prompt}\n`,
      });

      const messages: import("../utils/ai").Message[] = [{ role: "system", content: prompt }];
      let loops = 0;
      let toolCount = 0;
      let resultChars = 0;
      let idleTimeoutMs = STREAM_IDLE_TIMEOUT_MS;

      const blockedTools = new Set(["terminal", "subagents", ...(excludeTools ?? [])]);
      const activeTools = builtInTools().filter((tool) => !blockedTools.has(tool.function.name));
      const activeToolNames = new Set(activeTools.map((tool) => tool.function.name));

      let loopLimit = 15;

      try {
        for (; loops < loopLimit; loops++) {
          if (!activeTasks.current.has(agentId)) break;
          broadcastStatus(agentId, { status: "running", lastMessage: "Pensando..." });

          let fullContent = "";
          const toolCalls: any[] = [];

          let streamTimedOut = false;
          let idleTimer = window.setTimeout(() => {
            streamTimedOut = true;
            agentAbort.abort();
          }, idleTimeoutMs);
          const resetIdleTimer = () => {
            window.clearTimeout(idleTimer);
            idleTimer = window.setTimeout(() => {
              streamTimedOut = true;
              agentAbort.abort();
            }, idleTimeoutMs);
          };
          try {
            for await (const event of streamCompletion(
              messages,
              config,
              activeTools,
              agentAbort.signal,
            )) {
              resetIdleTimer();
              if (!activeTasks.current.has(agentId)) {
                agentAbort.abort();
                break;
              }
              if (event.type === "content") fullContent += event.text;
              else if (event.type === "tool_call_done") toolCalls.push(event.call);
              else if (event.type === "done") break;
            }
          } catch (err) {
            if (streamTimedOut)
              throw new Error(
                `Model stream timed out after ${Math.round(idleTimeoutMs / 1000)} seconds without activity.`,
              );
            throw err;
          } finally {
            window.clearTimeout(idleTimer);
          }

          messages.push({
            role: "assistant",
            content: fullContent,
            tool_calls: toolCalls.length ? toolCalls : undefined,
          });

          if (fullContent) {
            broadcastStatus(agentId, { appendLog: `\n[THOUGHT]\n${fullContent}\n` });
          }

          if (toolCalls.length === 0) {
            broadcastStatus(agentId, {
              status: "done",
              lastMessage: "Completado",
              appendLog: `\n[DONE] No more tool calls.\n`,
            });
            setTimeout(() => {
              setAgents((prev) => prev.filter((a) => a.id !== agentId));
            }, 5000);
            break;
          }

          for (const call of toolCalls) {
            if (!activeTasks.current.has(agentId)) break;
            if (!activeToolNames.has(call.function.name)) {
              messages.push({
                role: "tool",
                content: `Error: Tool '${call.function.name}' is unavailable to subagents.`,
                tool_call_id: call.id,
              });
              broadcastStatus(agentId, { appendLog: `[BLOCKED] ${call.function.name}\n` });
              continue;
            }
            toolCount++;

            let argsStr = call.function.arguments;
            try {
              argsStr = JSON.stringify(JSON.parse(argsStr), null, 2);
            } catch {}

            broadcastStatus(agentId, {
              status: "tool",
              currentTool: call.function.name,
              lastMessage: `Ejecutando ${call.function.name}...`,
              toolCount,
              appendLog: `\n[CALL: ${call.function.name}]\nArgs: ${argsStr}\n`,
            });

            try {
              const content = await executeRegisteredTool(call, workspacePath, {
                config,
                sandbox: false,
                signal: agentAbort.signal,
              });
              resultChars += content.length;
              idleTimeoutMs += 30_000;
              messages.push({ role: "tool", content, tool_call_id: call.id });
              broadcastStatus(agentId, {
                resultChars,
                appendLog: `[RESULT]\nChars: ${content.length}\nPreview: ${content.substring(0, 150).replace(/\n/g, " ")}...\n`,
              });
              // Tool usada correctamente, extendemos dinámicamente el límite
              if (loopLimit < 60) loopLimit++;
            } catch (e) {
              messages.push({
                role: "tool",
                content: `Error: ${(e as Error).message}`,
                tool_call_id: call.id,
              });
              broadcastStatus(agentId, { appendLog: `[ERROR]\n${(e as Error).message}\n` });
            }
          }
        }

        if (loops >= loopLimit) {
          broadcastStatus(agentId, {
            status: "done",
            lastMessage: "Límite alcanzado",
            appendLog: `\n[DONE] Max loops reached.\n`,
          });
          setTimeout(() => {
            setAgents((prev) => prev.filter((a) => a.id !== agentId));
          }, 5000);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          broadcastStatus(agentId, {
            status: "error",
            lastMessage: `Error: ${(err as Error).message}`,
            appendLog: `\n[FATAL ERROR]\n${(err as Error).message}\n`,
          });
        }
      } finally {
        activeTasks.current.delete(agentId);
        abortControllers.current.delete(agentId);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "agent_done",
              payload: { id: agentId, result: messages },
            }),
          );
        }
      }
      return messages;
    },
    [config, broadcastStatus],
  );

  useEffect(() => {
    const onLocalSubagents = async (event: Event) => {
      const { batchId, agents: specs, workspacePath } = (event as CustomEvent).detail;
      const reports = await Promise.all(
        specs.map(async (spec: { role: string; task: string }) => {
          const id = crypto.randomUUID();
          setAgents((prev) => [
            ...prev,
            { id, role: spec.role, status: "idle", resultChars: 0, toolCount: 0 },
          ]);
          const prompt = `ROLE: ${spec.role}\nTASK: ${spec.task}\nWORKSPACE: ${workspacePath}\n\nWork autonomously within this scope. Use file and search tools; terminal and subagents are unavailable. Finish with a concise report.`;
          const result = await runAgent(id, spec.role, prompt, workspacePath, [
            "terminal",
            "subagents",
          ]);
          const report =
            result?.findLast((message) => message.role === "assistant" && message.content)
              ?.content || "No final report.";
          return { id, role: spec.role, report };
        }),
      );
      window.dispatchEvent(
        new CustomEvent(`codeclub:subagents-result:${batchId}`, { detail: { ok: true, reports } }),
      );
    };
    window.addEventListener("codeclub:spawn-subagents", onLocalSubagents);
    return () => window.removeEventListener("codeclub:spawn-subagents", onLocalSubagents);
  }, [runAgent]);

  useEffect(() => {
    if (!port) return;
    const connect = () => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "register", payload: { role: "ui-worker" } }));
        (window as any).__codeclubSwarmReady = true;
        window.dispatchEvent(new CustomEvent("codeclub:swarm-ready"));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "spawn_agent" && msg.from !== "ui-worker") {
            const agentId = msg.payload.id || crypto.randomUUID();
            const role = msg.payload.role || "subagent";
            setAgents((prev) => [
              ...prev,
              { id: agentId, role, status: "idle", resultChars: 0, toolCount: 0 },
            ]);
            runAgent(
              agentId,
              role,
              msg.payload.prompt,
              msg.payload.workspacePath,
              msg.payload.excludeTools,
            );
          }
        } catch {}
      };

      ws.onclose = () => {
        (window as any).__codeclubSwarmReady = false;
        setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      (window as any).__codeclubSwarmReady = false;
      if (wsRef.current) {
        const ws = wsRef.current;
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => ws.close();
        } else {
          ws.close();
        }
      }
    };
  }, [port, runAgent]);

  const killAgent = useCallback(
    (id: string) => {
      activeTasks.current.delete(id);
      abortControllers.current.get(id)?.abort();
      broadcastStatus(id, { status: "error", lastMessage: "Cancelado" });
    },
    [broadcastStatus],
  );

  const killAll = useCallback(() => {
    for (const id of activeTasks.current) {
      broadcastStatus(id, { status: "error", lastMessage: "Pausado/Cancelado" });
      abortControllers.current.get(id)?.abort();
    }
    activeTasks.current.clear();
  }, [broadcastStatus]);

  const clearAgents = useCallback(() => {
    setAgents((prev) => prev.filter((a) => activeTasks.current.has(a.id)));
  }, []);

  return { agents, killAgent, killAll, clearAgents };
}
