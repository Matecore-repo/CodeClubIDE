import { useEffect, useMemo, useRef, useState } from "react";
import { useFileExplorer } from "../../hooks/useFileExplorer";
import { DirItem } from "./DirItem";
import { s } from "./styles";
import { StudioPane } from "./StudioPane";
import { useKeyboardNavigation } from "./useKeyboardNavigation";
import { ExplorerHeader } from "./ExplorerHeader";
import { ExplorerTabs } from "./ExplorerTabs";
import { ContextMenu } from "./ContextMenu";
import { ExplorerModals } from "./ExplorerModals";
import { DesignPane } from "./DesignPane";

export function FileExplorer({
  rootPath,
  onFileSelect,
  mode = "folders",
  onModeChange,
  activeColor,
}: {
  rootPath: string | null;
  onFileSelect?: (path: string) => void;
  mode?: "folders" | "studio" | "design";
  onModeChange?: (mode: "folders" | "studio" | "design") => void;
  activeColor?: string;
}) {
  const f = useFileExplorer(rootPath);
  const rootName = rootPath?.split("\\").pop() || rootPath?.split("/").pop() || rootPath || "";
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [hasStudioSelection, setHasStudioSelection] = useState(false);
  const visibleChildren = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return f.rootChildren;
    return f.rootChildren.filter((child) => child.name.toLowerCase().includes(q));
  }, [f.rootChildren, query]);

  useEffect(() => {
    const openFileModal = () => {
      if (mode === "folders") f.setShowCreateFile(true);
    };
    const openFolderModal = () => {
      if (mode === "folders") f.setShowCreateDir(true);
    };
    window.addEventListener("codeclub:open-new-file-modal", openFileModal);
    window.addEventListener("codeclub:open-new-folder-modal", openFolderModal);
    return () => {
      window.removeEventListener("codeclub:open-new-file-modal", openFileModal);
      window.removeEventListener("codeclub:open-new-folder-modal", openFolderModal);
    };
  }, [f, mode]);

  useEffect(() => {
    if (mode !== "studio") {
      setHasStudioSelection(false);
      return;
    }

    const onStudioSelection = (event: Event) => {
      setHasStudioSelection(Boolean((event as CustomEvent).detail));
    };

    setHasStudioSelection(false);
    window.addEventListener("codeclub:studio-selection-state", onStudioSelection);
    return () => window.removeEventListener("codeclub:studio-selection-state", onStudioSelection);
  }, [mode]);

  useEffect(() => {
    if (f.selectedPath && containerRef.current) {
      const activeEl = containerRef.current.querySelector(
        `[data-path="${f.selectedPath.replace(/\\/g, "\\\\").replace(/"/g, '\\"') /* Safe escaping */}"]`,
      ) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [f.selectedPath]);

  const handleKeyDown = useKeyboardNavigation(f, mode, containerRef);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseDown={() => containerRef.current?.focus()}
      onKeyDown={handleKeyDown}
      style={{ ...s.panel, outline: "none" }}
      onContextMenu={(e) => {
        if (mode === "studio") {
          e.preventDefault();
          return;
        }
        f.handleContextMenu(e, null);
      }}
    >
      <ExplorerHeader
        rootName={rootName}
        mode={mode}
        hasStudioSelection={hasStudioSelection}
        setShowCreateDir={f.setShowCreateDir}
        setShowCreateFile={f.setShowCreateFile}
      />
      <ExplorerTabs query={query} setQuery={setQuery} mode={mode} onModeChange={onModeChange} />
      <div style={mode === "studio" ? s.studioPane : mode === "design" ? s.designPane : s.tree}>
        {/* Studio mode */}
        {mode === "studio" ? (
          <StudioPane workspacePath={rootPath!} activeColor={activeColor} />
        ) : /* Design mode */ mode === "design" ? (
          <DesignPane workspacePath={rootPath!} query={query} activeColor={activeColor} />
        ) : /* Coding mode (folders) */ f.loading ? (
          <div
            style={{
              padding: "12px",
              textAlign: "center",
              color: "var(--text-weaker)",
              fontSize: "var(--font-size-small)",
            }}
          >
            Loading...
          </div>
        ) : f.rootChildren.length === 0 && !f.renaming ? (
          <div
            style={{
              padding: "12px",
              textAlign: "center",
              color: "var(--text-weaker)",
              fontSize: "var(--font-size-small)",
            }}
          >
            Empty
          </div>
        ) : (
          visibleChildren.map((child) => (
            <DirItem
              key={child.path}
              name={child.name}
              path={child.path}
              isDirectory={child.isDirectory}
              depth={0}
              onFileSelect={onFileSelect ?? (() => {})}
              selectedPath={f.selectedPath}
              onSelect={f.handleSelect}
              onContextMenu={f.handleContextMenu}
              draggedPathRef={f.draggedPathRef}
              dragOverDir={f.dragOverDir}
              onDragOver={(_e, dirPath) => f.setDragOverDir(dirPath)}
              onDragLeave={() => f.setDragOverDir(null)}
              onDrop={f.handleDrop}
              renaming={f.renaming}
              renameVal={f.renameVal}
              renameRef={f.renameRef}
              onRenameChange={f.setRenameVal}
              onRenameKey={f.handleRenameKey}
              onRenameBlur={() => f.doRename()}
              activeColor={activeColor}
            />
          ))
        )}
      </div>

      {f.renameError && <div style={s.errorBar}>{f.renameError}</div>}
      <ContextMenu f={f} />
      {f.createError && <div style={s.errorBar}>{f.createError}</div>}
      <ExplorerModals f={f} />
    </div>
  );
}
