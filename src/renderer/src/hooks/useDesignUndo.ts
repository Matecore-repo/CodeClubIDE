import { useCallback, useRef } from "react";
import type { DesignManifest, DesignPage } from "../../../shared/design";

const MAX = 50;

export type DesignSnapshot = {
  manifest: DesignManifest;
  page: DesignPage;
};

export function useDesignUndo() {
  const stackRef = useRef<DesignSnapshot[]>([]);
  const pointerRef = useRef(-1);
  const lockedRef = useRef(false);

  const push = useCallback((snapshot: DesignSnapshot) => {
    if (lockedRef.current) return;
    const current = stackRef.current[pointerRef.current];
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;
    stackRef.current = [...stackRef.current.slice(0, pointerRef.current + 1), snapshot];
    if (stackRef.current.length > MAX) stackRef.current = stackRef.current.slice(-MAX);
    pointerRef.current = stackRef.current.length - 1;
  }, []);

  const undo = useCallback((): DesignSnapshot | null => {
    if (pointerRef.current <= 0) return null;
    pointerRef.current--;
    lockedRef.current = true;
    const snapshot = stackRef.current[pointerRef.current];
    return snapshot;
  }, []);

  const redo = useCallback((): DesignSnapshot | null => {
    if (pointerRef.current >= stackRef.current.length - 1) return null;
    pointerRef.current++;
    lockedRef.current = true;
    return stackRef.current[pointerRef.current];
  }, []);

  const unlock = useCallback(() => {
    lockedRef.current = false;
  }, []);

  const clear = useCallback(() => {
    stackRef.current = [];
    pointerRef.current = -1;
  }, []);

  return { push, undo, redo, unlock, clear };
}
