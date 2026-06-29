import { useCallback, useRef } from "react";
import type { ChatMessage } from "./agentTypes";

export function useChatCheckpoints(
  workspacePath: string | undefined,
  sessionKey: string | undefined,
  stop: () => void,
  setMessages: (messages: ChatMessage[]) => void,
  saveMessages: (messages: ChatMessage[]) => void,
  setError: (error: string | null) => void,
) {
  const checkpointRef = useRef<string | null>(null);

  const createCheckpoint = useCallback(
    async (label: string, messages: ChatMessage[]) => {
      if (!workspacePath || !sessionKey) {
        checkpointRef.current = null;
        return null;
      }
      const sessionId = sessionKey.slice(sessionKey.lastIndexOf("::") + 2);
      checkpointRef.current = await window.api.checkpointCreate(
        sessionId,
        workspacePath,
        label.slice(0, 80),
        messages,
      );
      return checkpointRef.current;
    },
    [sessionKey, workspacePath],
  );

  const captureFile = useCallback(async (path: string) => {
    if (checkpointRef.current) return window.api.checkpointCapture(checkpointRef.current, path);
    return { captured: false, reason: "No checkpoint" };
  }, []);

  const restoreCheckpoint = useCallback(
    async (checkpointId: string) => {
      stop();
      const result = await window.api.checkpointRestore(checkpointId);
      const restored = result.messages as ChatMessage[];
      setMessages(restored);
      saveMessages(restored);
      setError(result.errors.length ? `Rollback parcial: ${result.errors.join("; ")}` : null);
    },
    [saveMessages, setError, setMessages, stop],
  );

  return { checkpointRef, createCheckpoint, captureFile, restoreCheckpoint };
}
