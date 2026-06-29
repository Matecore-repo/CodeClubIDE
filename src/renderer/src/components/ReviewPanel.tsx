import React, { useEffect, useState, useMemo } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { computeDiffStats } from "../utils/diff";

interface ReviewPanelProps {
  workspacePath: string;
  displayMessages: any[];
  onClose: () => void;
}

interface DiffFile {
  path: string;
  originalContent: string;
  modifiedContent: string;
  additions: number;
  deletions: number;
}

export function ReviewPanel({ workspacePath, displayMessages, onClose }: ReviewPanelProps) {
  const [_turnsBack, _setTurnsBack] = useState<number>(1);
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(-1);
  const [loading, setLoading] = useState(false);

  const _selectedFile = diffFiles[selectedFileIdx] || null;

  useEffect(() => {
    const onFileSaved = async (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string; workspacePath?: string | null }>)
        .detail;
      if (!detail?.filePath || detail.workspacePath !== workspacePath) return;
      const [original, modifiedContent] = await Promise.all([
        window.api.gitFileOriginal(workspacePath, detail.filePath),
        window.api.readFile(detail.filePath),
      ]);
      if (!original.ok || modifiedContent === null) return;
      setDiffFiles((current) => {
        const withoutFile = current.filter((file) => file.path !== detail.filePath);
        if (original.content === modifiedContent) return withoutFile;
        const stats = computeDiffStats(original.content, modifiedContent);
        return [
          ...withoutFile,
          {
            path: detail.filePath!,
            originalContent: original.content,
            modifiedContent,
            additions: stats.additions,
            deletions: stats.deletions,
          },
        ];
      });
    };
    window.addEventListener("codeclub:file-saved", onFileSaved);
    const savedFiles: Set<string> | undefined = (window as any).__codeclubSavedFiles;
    savedFiles?.forEach((filePath) => {
      void onFileSaved(
        new CustomEvent("codeclub:file-saved", { detail: { filePath, workspacePath } }),
      );
    });
    return () => window.removeEventListener("codeclub:file-saved", onFileSaved);
  }, [workspacePath]);

  const totalAdditions = useMemo(
    () => diffFiles.reduce((acc, f) => acc + f.additions, 0),
    [diffFiles],
  );
  const totalDeletions = useMemo(
    () => diffFiles.reduce((acc, f) => acc + f.deletions, 0),
    [diffFiles],
  );

  useEffect(() => {
    let active = true;
    async function loadDiffs() {
      setLoading(true);
      try {
        const userMsgs = displayMessages.filter(
          (m) =>
            m.type === "message" &&
            m.message.role === "user" &&
            m.message.checkpointId &&
            m.message.checkpointFilesCaptured,
        );
        if (userMsgs.length === 0) {
          if (active) setDiffFiles([]);
          return;
        }

        // Get the target user message based on turnsBack
        const targetIdx = Math.max(0, userMsgs.length - _turnsBack);
        const targetMsg = userMsgs[targetIdx];
        const checkpointId = targetMsg.message.checkpointId;

        const checkpoint = await window.api.checkpointGet(checkpointId);
        if (!checkpoint || !checkpoint.files) {
          if (active) setDiffFiles([]);
          return;
        }

        const files: DiffFile[] = [];
        for (const file of checkpoint.files) {
          if (file.skipped) continue;

          const originalContent = file.content ? atob(file.content) : "";

          let modifiedContent = "";
          try {
            const currentBase64 = await window.api.readFileBase64(file.path);
            if (currentBase64) modifiedContent = atob(currentBase64);
          } catch {
            // file might be deleted now
          }

          if (originalContent !== modifiedContent) {
            const stats = computeDiffStats(originalContent, modifiedContent);
            files.push({
              path: file.path,
              originalContent,
              modifiedContent,
              additions: stats.additions,
              deletions: stats.deletions,
            });
          }
        }

        if (active) {
          setDiffFiles((current) => [
            ...files,
            ...current.filter((existing) => !files.some((file) => file.path === existing.path)),
          ]);
          setSelectedFileIdx(-1);
        }
      } catch (err) {
        console.error("Error loading review diffs:", err);
        if (active) setDiffFiles([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDiffs();
    return () => {
      active = false;
    };
  }, [workspacePath, displayMessages, _turnsBack]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#111111",
        color: "var(--text-strong)",
      }}
    >
      {/* Header toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 12px",
          borderBottom: "1px solid var(--border-weaker-base)",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          title="Back"
          style={{
            border: "none",
            background: "transparent",
            color: "var(--icon-base)",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <div
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}
        >
          <span style={{ color: "var(--text-weaker)", fontSize: "var(--font-size-small)" }}>
            Total Changes:
          </span>
          <span style={{ color: "#4caf50", fontSize: "var(--font-size-small)" }}>
            +{totalAdditions}
          </span>
          <span style={{ color: "#f44336", fontSize: "var(--font-size-small)" }}>
            -{totalDeletions}
          </span>
        </div>

        <div style={{ flex: 1 }} />
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-weaker)",
            }}
          >
            Loading differences...
          </div>
        ) : diffFiles.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-weaker)",
            }}
          >
            No changes detected for the selected turns.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
            {diffFiles.map((file, i) => {
              const isExpanded = selectedFileIdx === i;
              const relPath = file.path
                .replace(workspacePath + "\\", "")
                .replace(workspacePath + "/", "");
              const lastSlash =
                relPath.lastIndexOf("/") !== -1
                  ? relPath.lastIndexOf("/")
                  : relPath.lastIndexOf("\\");
              const dirPath = lastSlash !== -1 ? relPath.substring(0, lastSlash + 1) : "";
              const fileName = lastSlash !== -1 ? relPath.substring(lastSlash + 1) : relPath;
              const ext = fileName.split(".").pop()?.toUpperCase() || "";
              const _isTs = ext === "TS" || ext === "TSX";
              const _isJson = ext === "JSON";

              return (
                <div
                  key={file.path}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {/* File Header Bar */}
                  <div
                    onClick={() => setSelectedFileIdx(isExpanded ? -1 : i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "12px 16px",
                      cursor: "pointer",
                      background: isExpanded ? "rgba(255,255,255,0.04)" : "transparent",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontFamily: "var(--font-family-sans)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <span style={{ color: "var(--text-weaker)" }}>
                        {dirPath.replace(/\\/g, "/")}
                      </span>
                      <span style={{ color: "var(--text-strong)" }}>{fileName}</span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontFamily: "var(--font-family-mono)",
                      }}
                    >
                      <span style={{ color: "#4caf50" }}>+{file.additions}</span>
                      <span style={{ color: "#f44336" }}>-{file.deletions}</span>
                    </div>
                  </div>

                  {/* Monaco Diff Editor */}
                  {isExpanded && (
                    <div
                      style={{
                        height: 400,
                        width: "100%",
                        borderTop: "1px solid rgba(255,255,255,0.02)",
                      }}
                    >
                      <DiffEditor
                        theme="ide-theme"
                        original={file.originalContent}
                        modified={file.modifiedContent}
                        language={
                          file.path.split(".").pop() === "ts" ||
                          file.path.split(".").pop() === "tsx"
                            ? "typescript"
                            : "javascript"
                        }
                        keepCurrentModifiedModel={true}
                        keepCurrentOriginalModel={true}
                        options={{
                          readOnly: false,
                          renderSideBySide: true,
                          minimap: { enabled: false },
                          renderOverviewRuler: false,
                          scrollBeyondLastLine: false,
                          fontSize: 13,
                          fontFamily: "var(--font-family-mono)",
                          automaticLayout: true,
                          scrollbar: {
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                            vertical: "visible",
                            horizontal: "visible",
                            useShadows: false,
                          },
                        }}
                        onMount={(editor, monaco) => {
                          monaco.editor.defineTheme("ide-theme", {
                            base: "vs-dark",
                            inherit: true,
                            rules: [],
                            colors: {
                              "editor.background": "#101010",
                              "editorWidget.background": "#121212",
                              "editorWidget.border": "rgba(255, 255, 255, 0.15)",
                              "input.background": "rgba(255, 255, 255, 0.05)",
                              "input.foreground": "#ffffff",
                              "input.border": "rgba(255, 255, 255, 0.1)",
                              "input.placeholderForeground": "#999999",
                              focusBorder: "#00000000",
                              "inputValidation.errorBackground": "#121212",
                              "inputValidation.errorBorder": "rgba(255, 255, 255, 0.15)",
                              "inputValidation.warningBackground": "#121212",
                              "inputValidation.warningBorder": "rgba(255, 255, 255, 0.15)",
                              "inputValidation.infoBackground": "#121212",
                              "inputValidation.infoBorder": "rgba(255, 255, 255, 0.15)",
                            },
                          });
                          monaco.editor.setTheme("ide-theme");

                          const modifiedEditor = editor.getModifiedEditor();
                          let saveTimeout: any;
                          modifiedEditor.onDidChangeModelContent(() => {
                            clearTimeout(saveTimeout);
                            saveTimeout = setTimeout(() => {
                              const newContent = modifiedEditor.getValue();
                              window.api
                                .writeFile(file.path, newContent)
                                .catch((err: any) =>
                                  console.error("Failed to save diff edit:", err),
                                );
                            }, 500);
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
