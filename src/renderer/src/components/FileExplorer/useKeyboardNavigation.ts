import { RefObject } from "react";

export function useKeyboardNavigation(
  f: any, // ReturnType<typeof useFileExplorer>
  mode: "folders" | "studio" | "design",
  containerRef: RefObject<HTMLDivElement | null>,
) {
  return (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mode !== "folders") return;
    if (f.renaming) return;

    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === "c" || key === "x") {
        e.preventDefault();
        f.setClipboard(key === "c" ? "copy" : "cut");
        return;
      }
      if (key === "v") {
        e.preventDefault();
        void f.pasteClipboard();
        return;
      }
    }

    const items = containerRef.current
      ? (Array.from(containerRef.current.querySelectorAll(".file-explorer-item")) as HTMLElement[])
      : [];

    if (items.length === 0) return;

    const activeIdx = items.findIndex((item) => item.getAttribute("data-path") === f.selectedPath);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = activeIdx === -1 ? 0 : (activeIdx + 1) % items.length;
      const targetEl = items[nextIdx];
      const path = targetEl.getAttribute("data-path");
      const isDir = targetEl.getAttribute("data-is-directory") === "true";
      f.handleSelect(path, isDir);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIdx =
        activeIdx === -1 ? items.length - 1 : (activeIdx - 1 + items.length) % items.length;
      const targetEl = items[prevIdx];
      const path = targetEl.getAttribute("data-path");
      const isDir = targetEl.getAttribute("data-is-directory") === "true";
      f.handleSelect(path, isDir);
    } else if (e.key === "ArrowRight") {
      if (activeIdx !== -1) {
        const targetEl = items[activeIdx];
        const isDir = targetEl.getAttribute("data-is-directory") === "true";
        const isExpanded = targetEl.getAttribute("data-expanded") === "true";
        if (isDir && !isExpanded) {
          e.preventDefault();
          targetEl.click();
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (activeIdx !== -1) {
        const targetEl = items[activeIdx];
        const isDir = targetEl.getAttribute("data-is-directory") === "true";
        const isExpanded = targetEl.getAttribute("data-expanded") === "true";
        if (isDir && isExpanded) {
          e.preventDefault();
          targetEl.click();
        }
      }
    } else if (e.key === "Enter") {
      if (activeIdx !== -1) {
        e.preventDefault();
        items[activeIdx].click();
      }
    } else if (e.key === "F2") {
      if (activeIdx !== -1) {
        e.preventDefault();
        const targetEl = items[activeIdx];
        f.startRename({
          name: targetEl.getAttribute("data-name") || "",
          path: targetEl.getAttribute("data-path") || "",
          isDirectory: targetEl.getAttribute("data-is-directory") === "true",
        });
      }
    } else if (e.key === "Delete") {
      if (activeIdx !== -1) {
        e.preventDefault();
        const targetEl = items[activeIdx];
        f.setShowDelete({
          name: targetEl.getAttribute("data-name") || "",
          path: targetEl.getAttribute("data-path") || "",
          isDirectory: targetEl.getAttribute("data-is-directory") === "true",
        });
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      f.handleSelect(null, false);
    }
  };
}
