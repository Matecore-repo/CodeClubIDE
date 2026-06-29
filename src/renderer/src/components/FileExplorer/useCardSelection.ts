import { useCallback, useRef, useState } from "react";

/** Shared selection and drag state for sidebar card lists. */
export function useCardSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const draggedIds = useRef<string[]>([]);

  const select = useCallback((id: string, additive = false) => {
    setSelectedIds((current) => {
      if (!additive) return new Set([id]);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const beginDrag = useCallback(
    (id: string) => {
      draggedIds.current = selectedIds.has(id) ? [...selectedIds] : [id];
      return draggedIds.current;
    },
    [selectedIds],
  );

  return { selectedIds, select, clear, draggedIds, beginDrag };
}
