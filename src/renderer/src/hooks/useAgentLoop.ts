import { useState, useRef, useCallback, useEffect } from "react";
import type { AIConfig, Message } from "../utils/ai";
import { streamCompletion, maxContext, executeRegisteredTool } from "../utils/ai";
import { sanitizeToolHistory, toAPIMessage, compactMessages } from "../utils/ai/messages";
import { encode } from "gpt-tokenizer";
import { useAgentRun } from "./useAgentRun";
import { useChatCheckpoints } from "./useChatCheckpoints";
import { useAgentContext } from "./useAgentContext";

import type { ChatMessage, SessionStats, AgentPlan, AgentTodo } from "./agentTypes";
import { systemPrompt } from "../utils/ai/chatPrompt";

export type { ChatMessage, SessionStats, AgentPlan, AgentTodo } from "./agentTypes";

export function useAgentLoop(
  config: AIConfig | null,
  fileContext?: string,
  sessionMessages?: ChatMessage[],
  sessionKey?: string,
  onSave?: (msgs: ChatMessage[]) => void,
  workspacePath?: string,
  workspaceTree?: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  const planMode = true;
  const [plans, setPlans] = useState<AgentPlan[]>([]);
  const [todos, setTodos] = useState<AgentTodo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    totalTreeTokens: 0,
    totalChunkTokens: 0,
    messagesWithIndex: 0,
    messagesWithoutIndex: 0,
    semanticGreps: 0,
  });
  const [pendingQuestion, setPendingQuestion] = useState<{
    questions: any[];
    resolve: (ans: any[]) => void;
  } | null>(null);
  const cancelPendingQuestion = useCallback(() => {
    setPendingQuestion((pending) => {
      pending?.resolve([]);
      return null;
    });
  }, []);
  const {
    abortRef,
    activeRunRef: _activeRunRef,
    beginRun,
    assertActive,
    finishRun,
    stopRun,
  } = useAgentRun(cancelPendingQuestion, setLoading);
  const sessionKeyRef = useRef<string | undefined>(undefined);
  const knownFilesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (workspacePath) {
      window.api.storeGet("ui", `sandbox:${workspacePath}`).then((val) => {
        setSandbox(!!val);
      });
    }
  }, [workspacePath]);

  const toggleSandbox = useCallback(() => {
    if (!workspacePath) return;
    const next = !sandbox;
    setSandbox(next);
    window.api.storeSet("ui", `sandbox:${workspacePath}`, next);
  }, [sandbox, workspacePath]);

  const togglePlanMode = useCallback(() => {
    // Deprecated: Plan Mode is now controlled dynamically by the agent.
  }, []);

  useEffect(() => {
    if (sessionKey && sessionKey !== sessionKeyRef.current) {
      sessionKeyRef.current = sessionKey;
      setMessages(sessionMessages ?? []);
      knownFilesRef.current = new Set();
      setPlans([]);
      setTodos([]);
    } else if (!sessionKey && sessionKeyRef.current !== undefined) {
      sessionKeyRef.current = undefined;
      setMessages([]);
      knownFilesRef.current = new Set();
      setPlans([]);
      setTodos([]);
    }
  }, [sessionKey]);

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const saveMessages = useCallback((items: ChatMessage[]) => onSaveRef.current?.(items), []);
  const { checkpointRef, createCheckpoint, captureFile, restoreCheckpoint } = useChatCheckpoints(
    workspacePath,
    sessionKey,
    stopRun,
    setMessages,
    saveMessages,
    setError,
  );

  useEffect(() => {
    if (sessionKeyRef.current && onSaveRef.current) {
      onSaveRef.current(messages);
    }
  }, [messages]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (error) {
      errorTimerRef.current = setTimeout(() => setError(null), 15000);
    }
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [error]);

  const { prepareContext } = useAgentContext(
    workspacePath,
    workspaceTree,
    fileContext,
    sandbox,
    planMode,
    setStats as any,
  );

  const peakMemoryMb = useCallback(() => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
    return memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : undefined;
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!config) {
        setError("Configure API key first");
        return;
      }

      setError(null);
      setPlans([]);
      setTodos([]);

      const priorMsgs = messagesRef.current;
      const isManualCompact = text.trim() === "/compact";
      if (isManualCompact) {
        if (priorMsgs.length === 0) return;
        setCompacting(true);
        const result = await compactMessages(
          sanitizeToolHistory(priorMsgs).map(toAPIMessage),
          config,
          streamCompletion,
          true,
        );
        if (result) {
          const compacted: ChatMessage[] = result.messages.map((m: any) => ({
            id: crypto.randomUUID(),
            role: m.role as ChatMessage["role"],
            content: m.content,
          }));
          setMessages(compacted);
          if (onSaveRef.current) onSaveRef.current(compacted);
        } else {
          setError(
            "Not enough context to compact. (Requires at least 3 messages, with no incomplete tool calls)",
          );
        }
        setCompacting(false);
        return;
      }

      const { runId, controller: abort } = beginRun();
      const checkpointId = await createCheckpoint(text, priorMsgs);
      let msgsForAgent = priorMsgs;

      const ctx = config.model ? maxContext(config.model) : 128000;
      const estimated = priorMsgs.reduce(
        (total, message) => total + encode(message.content).length,
        0,
      );
      if (estimated >= ctx * 0.5) {
        setCompacting(true);
        const result = await compactMessages(
          sanitizeToolHistory(priorMsgs).map(toAPIMessage),
          config,
          streamCompletion,
        );
        if (result) {
          const compacted: ChatMessage[] = result.messages.map((m: any) => ({
            id: crypto.randomUUID(),
            role: m.role as ChatMessage["role"],
            content: m.content,
          }));
          msgsForAgent = compacted;
          setMessages(compacted);
          const ref = onSaveRef.current;
          if (ref) ref(compacted);
        }
        setCompacting(false);
      }

      const userMsgId = crypto.randomUUID();
      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        content: text,
        checkpointId: checkpointId ?? undefined,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      const { agentMessages, activeTools, treeInfo, turnSummary } = await prepareContext(
        text,
        msgsForAgent,
      );

      const toolNames: string[] = [];
      let promptTokens = 0;
      let completionTokens = 0;
      let loops = 0;
      let maxLoops = 12;
      const uniqueToolsUsed = new Set<string>();

      try {
        for (; loops < maxLoops; loops += 1) {
          assertActive(runId);
          const assistantId = crypto.randomUUID();
          let fullContent = "";
          const toolCalls: Message["tool_calls"] = [];
          const startedAt = performance.now();
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: "assistant", content: "", treeInfo },
          ]);

          let streamTimedOut = false;
          let idleTimer = window.setTimeout(() => {
            streamTimedOut = true;
            abort.abort();
          }, STREAM_IDLE_TIMEOUT_MS);
          const resetIdleTimer = () => {
            window.clearTimeout(idleTimer);
            idleTimer = window.setTimeout(() => {
              streamTimedOut = true;
              abort.abort();
            }, STREAM_IDLE_TIMEOUT_MS);
          };
          try {
            for await (const event of streamCompletion(
              agentMessages,
              config,
              activeTools,
              abort.signal,
            )) {
              resetIdleTimer();
              assertActive(runId);
              if (event.type === "content") {
                fullContent += event.text;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m)),
                );
              } else if (event.type === "tool_call_done") {
                toolCalls.push(event.call);
              } else if (event.type === "done") {
                const fallbackPrompt = encode(JSON.stringify(agentMessages)).length;
                const fallbackCompletion = encode(fullContent).length;
                const usage = event.usage ?? {
                  prompt_tokens: fallbackPrompt,
                  completion_tokens: fallbackCompletion,
                  total_tokens: fallbackPrompt + fallbackCompletion,
                };
                usage.active_tools = toolNames.length + toolCalls.length;
                usage.latency_ms ??= Math.round(performance.now() - startedAt);
                usage.peak_memory_mb = peakMemoryMb();
                promptTokens += usage.prompt_tokens;
                completionTokens += usage.completion_tokens;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, usage, tool_calls: toolCalls, turnSummary } : m,
                  ),
                );
                break;
              }
            }
          } catch (err) {
            if (streamTimedOut)
              throw new Error("Model stream timed out after 45 seconds without activity.");
            throw err;
          } finally {
            window.clearTimeout(idleTimer);
          }

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: fullContent,
                    tool_calls: toolCalls.length ? toolCalls : undefined,
                    turnSummary,
                  }
                : message,
            ),
          );
          const assistantMessage: Message = { role: "assistant", content: fullContent };
          if (toolCalls.length > 0) assistantMessage.tool_calls = toolCalls;
          agentMessages.push(assistantMessage);

          if (toolCalls.length === 0) break;

          for (const call of toolCalls) {
            assertActive(runId);
            toolNames.push(call.function.name);
            turnSummary.toolNames.push(call.function.name);

            let toolKey = call.function.name;
            try {
              const args = JSON.parse(call.function.arguments);
              if (args.subtool) toolKey += `:${args.subtool}`;
            } catch {}
            const prevSize = uniqueToolsUsed.size;
            uniqueToolsUsed.add(toolKey);
            if (uniqueToolsUsed.size > prevSize) maxLoops += 2;

            const toolResultId = crypto.randomUUID();
            setMessages((prev) => [
              ...prev,
              {
                id: toolResultId,
                role: "tool",
                content: "",
                tool_call_id: call.id,
                toolName: call.function.name,
                pending: true,
              },
            ]);

            const content = await executeRegisteredTool(call, workspacePath, {
              config,
              signal: abort.signal,
              sandbox,
              runId,
              checkpointId: checkpointRef.current ?? undefined,
              captureFile: async (path) => {
                const result = await captureFile(path);
                if (result.captured) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === userMsgId ? { ...m, checkpointFilesCaptured: true } : m,
                    ),
                  );
                }
              },
              askUser: (questions) =>
                new Promise((resolve) => setPendingQuestion({ questions, resolve })),
              onPlanUpdate: (scope, title, steps) => {
                setPlans((prev) => {
                  const next = prev.filter((plan) => plan.scope !== scope);
                  return [...next, { scope, title, steps }];
                });
              },
              onTodoUpdate: (title, tasks) => {
                setTodos([{ title, tasks }]);
              },
            });

            const toolMessage: Message = { role: "tool", content, tool_call_id: call.id };
            agentMessages.push(toolMessage);
            setMessages((prev) =>
              prev.map((m) => (m.id === toolResultId ? { ...m, content, pending: false } : m)),
            );
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        setLoading(false);
        finishRun(runId);
      }

      if (config) {
        window.api
          .logStats({
            model: config.model || "unknown",
            loops,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            tools: toolNames,
            charsRead: turnSummary.totalCharsRead,
          })
          .catch(() => {});
      }
    },
    [
      config,
      fileContext,
      workspacePath,
      planMode,
      sandbox,
      prepareContext,
      beginRun,
      createCheckpoint,
      finishRun,
      assertActive,
      checkpointRef,
      captureFile,
      peakMemoryMb,
      onSaveRef,
      messagesRef,
    ],
  );

  const stop = stopRun;

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const regenerate = useCallback(
    async (messageId: string) => {
      if (!config) return;
      const currentMsgs = messagesRef.current;
      const msgIdx = currentMsgs.findIndex((m) => m.id === messageId);
      if (msgIdx === -1) return;
      const prevMessages = currentMsgs.slice(0, msgIdx);
      const lastUser = [...prevMessages].reverse().find((m) => m.role === "user");
      if (!lastUser) return;
      setError(null);
      setLoading(true);
      const assistantId = crypto.randomUUID();
      setMessages([...prevMessages, { id: assistantId, role: "assistant", content: "" }]);
      const abort = new AbortController();
      abortRef.current = abort;
      const apiMessages: Message[] = [
        { role: "system", content: systemPrompt(workspacePath, fileContext) },
        ...prevMessages.map(toAPIMessage),
      ];
      let gotFirstChunk = false;
      const timeoutId = setTimeout(() => {
        if (!gotFirstChunk) abort.abort();
      }, 15000);
      try {
        let fullContent = "";
        for await (const event of streamCompletion(apiMessages, config, undefined, abort.signal)) {
          if (!gotFirstChunk) {
            gotFirstChunk = true;
            clearTimeout(timeoutId);
          }
          if (event.type === "content") {
            fullContent += event.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m)),
            );
          } else if (event.type === "done") {
            if (event.usage) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, usage: event.usage } : m)),
              );
            }
            break;
          }
        }
      } catch (err) {
        if (!gotFirstChunk && (err as Error).name === "AbortError") {
          setError("Model did not respond in 15 seconds");
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        } else if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
        abortRef.current = null;
      }
    },
    [config, fileContext, workspacePath],
  );

  return {
    messages,
    loading,
    compacting,
    error,
    sendMessage,
    stop,
    clear,
    regenerate,
    restoreCheckpoint,
    stats,
    sandbox,
    toggleSandbox,
    planMode,
    togglePlanMode,
    plans,
    todos,
    pendingQuestion,
    setPendingQuestion,
  };
}
const STREAM_IDLE_TIMEOUT_MS = 180_000;
