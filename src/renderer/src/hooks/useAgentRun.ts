import { useCallback, useRef } from "react";

export function useAgentRun(cancelQuestion: () => void, setLoading: (loading: boolean) => void) {
  const abortRef = useRef<AbortController | null>(null);
  const activeRunRef = useRef<string | null>(null);

  const beginRun = useCallback(() => {
    const runId = crypto.randomUUID();
    const controller = new AbortController();
    activeRunRef.current = runId;
    abortRef.current = controller;
    return { runId, controller };
  }, []);

  const assertActive = useCallback((runId: string) => {
    if (abortRef.current?.signal.aborted || activeRunRef.current !== runId) {
      throw new DOMException("Aborted", "AbortError");
    }
  }, []);

  const finishRun = useCallback((runId: string) => {
    if (activeRunRef.current === runId) activeRunRef.current = null;
    abortRef.current = null;
  }, []);

  const stopRun = useCallback(() => {
    const runId = activeRunRef.current;
    activeRunRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    if (runId) window.api.cancelRun(runId).catch(() => {});
    cancelQuestion();
    setLoading(false);
  }, [cancelQuestion, setLoading]);

  return { abortRef, activeRunRef, beginRun, assertActive, finishRun, stopRun };
}
