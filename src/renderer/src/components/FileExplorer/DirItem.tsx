import { useState, useEffect, useRef } from "react";
import { type DirEntry } from "../../hooks/useFileExplorer";
import { FolderIcon, FileIcon } from "./icons";
import { ExplorerBadge, ExplorerIcon, ExplorerItem, ExplorerLabel } from "./ExplorerItem";
import { s } from "./styles";

export function DirItem({
  name,
  path,
  isDirectory,
  depth,
  onFileSelect,
  selectedPath,
  onSelect,
  onContextMenu,
  draggedPathRef,
  dragOverDir,
  onDragOver,
  onDragLeave,
  onDrop,
  renaming,
  renameVal,
  renameRef,
  onRenameChange,
  onRenameKey,
  onRenameBlur,
  activeColor,
}: {
  name: string;
  path: string;
  isDirectory: boolean;
  depth: number;
  onFileSelect: (path: string) => void;
  selectedPath: string | null;
  onSelect: (p: string | null, isDirectory: boolean) => void;
  onContextMenu: (e: React.MouseEvent, entry: DirEntry) => void;
  draggedPathRef: React.MutableRefObject<string | null>;
  dragOverDir: string | null;
  onDragOver: (e: React.DragEvent, dirPath: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetDir: string) => void;
  renaming: string | null;
  renameVal: string;
  renameRef: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (v: string) => void;
  onRenameKey: (e: React.KeyboardEvent) => void;
  onRenameBlur: () => void;
  activeColor?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [childCount, setChildCount] = useState<number | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  useEffect(() => {
    if (!isDirectory) return;
    window.api
      .readDir(path)
      .then((list) => {
        setChildCount(list.length);
      })
      .catch(() => setChildCount(0));
  }, [isDirectory, path]);

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    window.api
      .readDir(path)
      .then((list) => {
        if (!expandedRef.current) return;
        setChildren(
          list.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
          }),
        );
        setLoading(false);
      })
      .catch(() => {
        setChildren([]);
        setLoading(false);
      });
  }, [expanded, path]);

  useEffect(() => {
    if (!expanded) return;
    window.api.watchDir(path);
    const unlisten = window.api.onFsChange((dirPath, _filename) => {
      if (dirPath === path && expandedRef.current) {
        window.api
          .readDir(path)
          .then((list) => {
            setChildren(
              list.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                return a.name.localeCompare(b.name);
              }),
            );
            setChildCount(list.length);
          })
          .catch(() => setChildren([]));
      }
    });
    return () => {
      window.api.unwatchDir(path);
      unlisten();
    };
  }, [expanded, path]);

  if (renaming === path) {
    return (
      <div
        style={{
          paddingLeft: 8 + depth * 16,
          paddingRight: 8,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <input
          ref={renameRef}
          style={{
            flex: 1,
            padding: "2px 6px",
            border: "1px solid var(--border-base)",
            borderRadius: "var(--radius-sm)",
            background: "var(--input-base)",
            color: "var(--text-strong)",
            fontSize: "var(--font-size-small)",
            outline: "none",
            fontFamily: "var(--font-family-sans)",
          }}
          value={renameVal}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={onRenameKey}
          onBlur={onRenameBlur}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  const isSelected = selectedPath === path;
  const isDragOver = dragOverDir === path && isDirectory;

  return (
    <>
      <div style={{ position: "relative" }}>
        {/* Render vertical lines for each ancestor level */}
        {Array.from({ length: depth }).map((_, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: 13 + i * 14,
              top: 0,
              bottom: 0,
              width: 1,
              background: "#252529",
              zIndex: 0,
            }}
          />
        ))}
        {/* Render horizontal connector to the current item */}
        {depth > 0 && (
          <span
            style={{
              position: "absolute",
              left: 13 + (depth - 1) * 14,
              top: 13, // center of the 26px item height
              width: 10,
              height: 1,
              background: "#252529",
              zIndex: 0,
            }}
          />
        )}
        <ExplorerItem
          as="div"
          active={isSelected}
          activeColor={activeColor}
          depth={depth}
          style={{
            position: "relative",
            zIndex: 1,
            boxShadow: "none",
            ...(isDragOver ? s.dropHighlight : {}),
          }}
          className="file-explorer-item"
          data-name={name}
          data-path={path}
          data-is-directory={isDirectory}
          data-expanded={expanded}
          draggable
          onClick={(e) => {
            e.stopPropagation();
            if (isDirectory) {
              setExpanded((p) => !p);
              onSelect(path, true);
            }
            if (!isDirectory) {
              onFileSelect(path);
              onSelect(path, false);
            }
          }}
          onContextMenu={(e) => onContextMenu(e, { name, path, isDirectory })}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", path);
            {
              e.dataTransfer.setData("application/x-codeclub-file", path);
              const label = document.createElement("div");
              label.textContent = `• Dragging ${name}`;
              Object.assign(label.style, {
                position: "fixed",
                left: "-1000px",
                top: "-1000px",
                padding: "6px 10px",
                borderRadius: "6px",
                background: "#111111",
                border: "1px solid #444",
                color: "#f5f5f6",
                fontSize: "12px",
                boxShadow: "0 6px 18px rgba(0,0,0,.35)",
              });
              document.body.appendChild(label);
              e.dataTransfer.setDragImage(label, 12, 14);
              dragImageRef.current = label;
            }
            draggedPathRef.current = path;
            e.stopPropagation();
          }}
          onDragEnd={() => {
            dragImageRef.current?.remove();
            dragImageRef.current = null;
          }}
          onDragOver={(e) => {
            if (isDirectory) {
              e.preventDefault();
              onDragOver(e, path);
            }
          }}
          onDragLeave={onDragLeave}
          onDrop={(e) => {
            if (isDirectory) {
              e.preventDefault();
              e.stopPropagation();
              onDrop(e, path);
            }
          }}
          title={path}
        >
          <ExplorerIcon>
            {loading ? (
              <div style={s.spinner} />
            ) : isDirectory ? (
              <FolderIcon expanded={expanded} />
            ) : (
              <FileIcon />
            )}
          </ExplorerIcon>
          <ExplorerLabel>{name}</ExplorerLabel>
          {isDirectory && typeof childCount === "number" && (
            <ExplorerBadge>{childCount}</ExplorerBadge>
          )}
        </ExplorerItem>
      </div>
      {expanded &&
        children?.map((child) => (
          <DirItem
            key={child.path}
            name={child.name}
            path={child.path}
            isDirectory={child.isDirectory}
            depth={depth + 1}
            onFileSelect={onFileSelect}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            draggedPathRef={draggedPathRef}
            dragOverDir={dragOverDir}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            renaming={renaming}
            renameVal={renameVal}
            renameRef={renameRef}
            onRenameChange={onRenameChange}
            onRenameKey={onRenameKey}
            onRenameBlur={onRenameBlur}
            activeColor={activeColor}
          />
        ))}
    </>
  );
}
