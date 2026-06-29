import { useRef, useEffect, useState } from "react";
import type { RagBlock } from "../../../preload/types";

interface SlashCommand {
  name: string;
  description: string;
  placeholder: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/goal",
    description: "Run until the specified goal is achieved",
    placeholder: "/goal [describe target goal...]",
  },
  {
    name: "/browser",
    description: "Invoke browser search/scraping tasks (no paid API key)",
    placeholder: "/browser [url or query...]",
  },
  {
    name: "/grill-me",
    description: "Interview to align plans and specifications",
    placeholder: "/grill-me [design or specs...]",
  },
  {
    name: "/teamwork-preview",
    description: "Invoke a team of agents to tackle projects autonomously",
    placeholder: "/teamwork-preview [describe task...]",
  },
  {
    name: "/compact",
    description: "Compact AI conversation context manually",
    placeholder: "/compact",
  },
];

export function ChatInput({
  input,
  setInput,
  loading,
  handleSend,
  stop,
  apiKey,
  onConfigure,
  skills = [],
  workspaceColor,
  workspacePath,
  workspaceFiles = [],
  caretShape,
  onFileSelect,
  showChat,
  swarm,
}: {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  handleSend: (context?: string) => void;
  stop: () => void;
  apiKey?: string;
  onConfigure?: () => void;
  skills?: { name: string; description: string }[];
  workspaceColor?: string;
  workspacePath?: string | null;
  workspaceFiles?: { name: string; path: string; relativePath: string }[];
  caretShape?: "bar" | "block";
  onFileSelect?: (path: string) => void;
  showChat?: boolean;
  swarm?: any;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownItems, setDropdownItems] = useState<
    { label: string; desc: string; val: string; kind: "command" | "file" | "find"; path?: string }[]
  >([]);
  const [selIdx, setSelIdx] = useState(0);
  const [pendingRag, setPendingRag] = useState<{ block: RagBlock; label: string }[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ path: string; label: string }[]>([]);
  const filePathMapRef = useRef<Record<string, string>>({}); // filename -> full path
  const [activeFile, setActiveFile] = useState<{ filePath: string; content: string | null } | null>(
    () => (window as any).__activeFile || null,
  );

  const [showFindWidget, setShowFindWidget] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [findMatches, setFindMatches] = useState<
    { label: string; line: number; relPath?: string }[]
  >([]);
  const [findSelIdx, setFindSelIdx] = useState(0);
  const [visibleMatchesCount, setVisibleMatchesCount] = useState(30);
  const findInputRef = useRef<HTMLInputElement>(null);
  const findMatchesRef = useRef<HTMLDivElement>(null);

  // Auto-expand visible matches when navigating down past visible limit
  useEffect(() => {
    if (findSelIdx >= visibleMatchesCount - 3) {
      setVisibleMatchesCount((_prev) => Math.min(findSelIdx + 20, findMatches.length));
    }
  }, [findSelIdx, findMatches.length, visibleMatchesCount]);

  // Debounce search query to optimize performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(findQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [findQuery]);

  useEffect(() => {
    const handleActiveFile = (e: Event) => {
      const detail = (e as CustomEvent<{ filePath: string; content: string | null } | null>).detail;
      setActiveFile(detail);
    };
    window.addEventListener("codeclub:active-file-changed", handleActiveFile);
    return () => window.removeEventListener("codeclub:active-file-changed", handleActiveFile);
  }, []);

  useEffect(() => {
    const triggerFind = () => {
      setShowFindWidget(true);
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
    };
    window.addEventListener("codeclub:trigger-find", triggerFind);
    return () => window.removeEventListener("codeclub:trigger-find", triggerFind);
  }, []);

  useEffect(() => {
    const focusChat = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (textRef.current) {
        textRef.current.focus();
        const newVal = textRef.current.value + detail;
        textRef.current.value = newVal;
        setInput(newVal);
      }
    };
    window.addEventListener("codeclub:focus-chat-input", focusChat);
    return () => window.removeEventListener("codeclub:focus-chat-input", focusChat);
  }, [setInput]);

  // Auto-scroll when navigating find matches with arrow keys/buttons
  useEffect(() => {
    if (showFindWidget && findMatches.length > 0 && findMatches[findSelIdx]) {
      const match = findMatches[findSelIdx];
      // Don't auto-open workspace matches on hover, only when selected
      if (match.relPath) return;
      window.dispatchEvent(
        new CustomEvent("codeclub:scroll-to-line", { detail: { line: match.line } }),
      );
    }
  }, [findSelIdx, findMatches, showFindWidget]);

  // Auto-scroll the dropdown list container to keep selected find match visible
  useEffect(() => {
    if (showFindWidget && findMatchesRef.current) {
      const parent = findMatchesRef.current;
      const child = parent.children[findSelIdx] as HTMLElement;
      if (child) {
        const parentRect = parent.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();
        if (childRect.top < parentRect.top) {
          parent.scrollTop -= parentRect.top - childRect.top;
        } else if (childRect.bottom > parentRect.bottom) {
          parent.scrollTop += childRect.bottom - parentRect.bottom;
        }
      }
    }
  }, [findSelIdx, showFindWidget]);

  // Perform search when debouncedQuery or activeFile changes
  useEffect(() => {
    setVisibleMatchesCount(30);
    if (!debouncedQuery.trim()) {
      setFindMatches([]);
      setFindSelIdx(0);
      return;
    }
    const q = debouncedQuery.toLowerCase();
    if (activeFile?.content) {
      const lines = activeFile.content.split("\n");
      const matches: { label: string; line: number }[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          matches.push({
            label: lines[i].trim(),
            line: i + 1,
          });
          if (matches.length >= 250) break; // increased limit
        }
      }
      setFindMatches(matches);
      setFindSelIdx(0);
    } else if (workspacePath) {
      // If no file open, search globally in workspace
      window.api.grep(q, workspacePath).then((results: string[]) => {
        const matches = results.map((res) => {
          const parts = res.split(":");
          const relPath = parts[0];
          const lineNum = parts[1];
          const lineText = parts.slice(2).join(":");
          return {
            label: lineText.trim(),
            line: parseInt(lineNum, 10),
            relPath,
          };
        });
        setFindMatches(matches);
        setFindSelIdx(0);
      });
    }
  }, [debouncedQuery, activeFile, workspacePath]);

  const handleMatchesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 30) {
      if (visibleMatchesCount < findMatches.length) {
        setVisibleMatchesCount((prev) => Math.min(prev + 30, findMatches.length));
      }
    }
  };

  useEffect(() => {
    const onRagCopy = (event: Event) => {
      const detail = (event as CustomEvent<{ block: RagBlock; label: string }>).detail;
      if (
        pendingRag.some(
          (item) =>
            item.block.filePath === detail.block.filePath &&
            item.block.startLine === detail.block.startLine &&
            item.block.endLine === detail.block.endLine,
        )
      )
        return;
      setPendingRag((current) => [...current, detail]);
      textRef.current?.focus();
    };
    window.addEventListener("codeclub:rag-copy", onRagCopy);
    return () => window.removeEventListener("codeclub:rag-copy", onRagCopy);
  }, [pendingRag]);

  // Auto-scroll al navegar con flechas
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const parent = dropdownRef.current;
      const child = parent.children[selIdx] as HTMLElement;
      if (child) {
        const parentRect = parent.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();

        if (childRect.top < parentRect.top) {
          parent.scrollTop -= parentRect.top - childRect.top;
        } else if (childRect.bottom > parentRect.bottom) {
          parent.scrollTop += childRect.bottom - parentRect.bottom;
        }
      }
    }
  }, [selIdx, showDropdown]);

  const adjustHeight = () => {
    const el = textRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [input]);

  // Manejar el desplegable al escribir "/"
  useEffect(() => {
    const parts = input.split(/\s+/);
    const lastWord = parts[parts.length - 1];

    if (lastWord.startsWith("/")) {
      const query = lastWord.toLowerCase();

      // Comandos base
      const baseCmds = SLASH_COMMANDS.map((c) => ({
        label: c.name,
        desc: c.description,
        val: c.name + " ",
        kind: "command" as const,
      }));

      // Skills como comandos directos
      const skillCmds = skills.map((s) => ({
        label: `/${s.name}`,
        desc: s.description,
        val: `/${s.name} `,
        kind: "command" as const,
      }));

      const allItems = [...baseCmds, ...skillCmds];
      const matched = allItems.filter((item) => item.label.toLowerCase().includes(query));

      setDropdownItems(matched);
      setShowDropdown(matched.length > 0);
      setSelIdx(0);
    } else if (lastWord.startsWith("@") && workspacePath) {
      const query = lastWord.slice(1).toLowerCase();
      const matched = workspaceFiles
        .filter(
          (file) =>
            !query ||
            file.name.toLowerCase().includes(query) ||
            file.relativePath.toLowerCase().includes(query),
        )
        .slice(0, 12)
        .map((file) => ({
          label: `@${file.name}`,
          desc: file.relativePath,
          val: `@${file.name}`,
          kind: "file" as const,
          path: file.path,
        }));
      setDropdownItems(matched);
      setShowDropdown(matched.length > 0);
      setSelIdx(0);
    } else {
      setShowDropdown(false);
    }
  }, [input, skills, workspaceFiles, workspacePath]);

  // Obtener placeholder dinámico si el mensaje tiene un comando activo
  const getPlaceholder = () => {
    const activeSkill = skills.find((s) => input.startsWith(`/${s.name}`));
    if (activeSkill) return `/${activeSkill.name} [describe task for this skill...]`;

    const activeCmd = SLASH_COMMANDS.find((c) => input.startsWith(c.name));
    return activeCmd ? activeCmd.placeholder : "Ask me anything";
  };

  const selectItem = async (item: (typeof dropdownItems)[number]) => {
    if (item.kind === "find" && item.path) {
      try {
        const data = JSON.parse(item.path);
        if (data.relPath && data.lineNum && workspacePath) {
          const fullPath = workspacePath + "/" + data.relPath;
          if (onFileSelect) {
            onFileSelect(fullPath);
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("codeclub:scroll-to-line", {
                  detail: { line: parseInt(data.lineNum, 10) },
                }),
              );
            }, 100);
          }
          setShowDropdown(false);
          return;
        }
      } catch {
        const lineNum = parseInt(item.path, 10);
        if (!isNaN(lineNum)) {
          window.dispatchEvent(
            new CustomEvent("codeclub:scroll-to-line", { detail: { line: lineNum } }),
          );
        }
      }
      return;
    }
    if (item.kind === "file" && item.path) {
      const filePath = item.path.replace(/\\/g, "/");
      const fileName = item.val; // e.g. "@filename.ts"
      // Store mapping name -> full path
      filePathMapRef.current[fileName] = filePath;
      // Replace the @partial token in the textarea with the full @name
      const tokenStart = input.lastIndexOf("@");
      const before = tokenStart >= 0 ? input.slice(0, tokenStart) : input;
      setInput(before + fileName + " ");
      setShowDropdown(false);
      setTimeout(() => {
        const ta = textRef.current;
        if (ta) {
          const pos = (before + fileName + " ").length;
          ta.setSelectionRange(pos, pos);
        }
        textRef.current?.focus();
      }, 0);
      return;
    }
    const parts = input.split(/\s+/);
    parts[parts.length - 1] = item.val;
    setInput(parts.join(" "));
    setShowDropdown(false);
    textRef.current?.focus();
  };

  const submit = async () => {
    if (!showChat) {
      setInput("");
      return;
    }
    if (workspacePath) {
      await Promise.all(pendingRag.map((item) => window.api.ragSave(workspacePath, item.block)));
    }
    // Parse inline @tokens from input text
    const inlineFileRefs = Array.from(input.matchAll(/@(\S+)/g))
      .map((m) => m[0]) // e.g. "@filename.ts"
      .filter((token) => filePathMapRef.current[token])
      .map((token) => `<file_reference path="${filePathMapRef.current[token]}" />`);
    const context = pendingRag
      .map(
        ({ block }) =>
          `<code_reference path="${block.filePath}" lines="${block.startLine}-${block.endLine}" language="${block.language}">\n${block.code}\n</code_reference>`,
      )
      .concat(inlineFileRefs)
      .join("\n\n");
    setPendingRag([]);
    setPendingFiles([]);
    handleSend(context || undefined);
  };

  const handleFindInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowFindWidget(false);
      textRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (findMatches.length > 0) {
        setFindSelIdx((prev) => (prev + 1) % findMatches.length);
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (findMatches.length > 0) {
        setFindSelIdx((prev) => (prev - 1 + findMatches.length) % findMatches.length);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        if (findMatches.length > 0) {
          setFindSelIdx((prev) => (prev - 1 + findMatches.length) % findMatches.length);
        }
      } else {
        if (findMatches.length > 0) {
          const match = findMatches[findSelIdx];
          if (match.relPath && workspacePath && onFileSelect) {
            // If it's a global workspace match, open file on Enter
            const fullPath = workspacePath + "/" + match.relPath;
            onFileSelect(fullPath);
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("codeclub:scroll-to-line", {
                  detail: { line: match.line, focus: true },
                }),
              );
            }, 100);
            setShowFindWidget(false);
          } else {
            window.dispatchEvent(
              new CustomEvent("codeclub:scroll-to-line", {
                detail: { line: match.line, focus: true },
              }),
            );
            setShowFindWidget(false);
          }
        }
      }
      return;
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (showDropdown) {
        setShowDropdown(false);
      } else {
        textRef.current?.blur();
      }
      return;
    }

    // Toggle find widget on Ctrl+F / Cmd+F inside the chat input
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setShowFindWidget(true);
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
      return;
    }

    if (e.key === "Backspace" && input.length === 0 && pendingRag.length > 0) {
      e.preventDefault();
      setPendingRag((current) => current.slice(0, -1));
      return;
    }
    if (showDropdown) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelIdx((prev) => (prev + 1) % dropdownItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelIdx((prev) => (prev - 1 + dropdownItems.length) % dropdownItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (dropdownItems[selIdx]) {
          void selectItem(dropdownItems[selIdx]);
        }
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!showChat) {
        setInput("");
        return;
      }
      if (!apiKey) {
        onConfigure?.();
        return;
      }
      submit();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        padding: "14px 18px 6px",
        position: "relative",
      }}
    >
      {showFindWidget && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 1px)",
            left: 12,
            right: 12,
            background: "#121212",
            border: "1px solid rgba(255,255,255,0.08)",
            borderBottom: "none",
            borderRadius: "10px 10px 0 0",
            boxShadow: "0 -16px 40px rgba(0, 0, 0, 0.35)",
            zIndex: 110,
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {/* Top Row: Input and Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-weaker)", paddingLeft: 4 }}>Find:</span>
            <input
              ref={findInputRef}
              type="text"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={handleFindInputKey}
              placeholder={
                activeFile ? "Type to search in active file..." : "Search globally in workspace..."
              }
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "5px",
                color: "#fff",
                fontSize: "13px",
                padding: "4px 8px",
                outline: "none",
              }}
            />
            {findMatches.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--text-weaker)", whiteSpace: "nowrap" }}>
                {findSelIdx + 1} of {findMatches.length}
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button
                onClick={() =>
                  setFindSelIdx((prev) => (prev - 1 + findMatches.length) % findMatches.length)
                }
                disabled={findMatches.length === 0}
                style={{
                  background: "transparent",
                  color: findMatches.length ? "var(--text-strong)" : "var(--text-weaker)",
                  cursor: findMatches.length ? "pointer" : "default",
                  opacity: findMatches.length ? 1 : 0.4,
                  padding: "4px",
                  display: "flex",
                  borderRadius: "4px",
                }}
                title="Previous Match (Shift+Enter)"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              <button
                onClick={() => setFindSelIdx((prev) => (prev + 1) % findMatches.length)}
                disabled={findMatches.length === 0}
                style={{
                  background: "transparent",
                  color: findMatches.length ? "var(--text-strong)" : "var(--text-weaker)",
                  cursor: findMatches.length ? "pointer" : "default",
                  opacity: findMatches.length ? 1 : 0.4,
                  padding: "4px",
                  display: "flex",
                  borderRadius: "4px",
                }}
                title="Next Match (Enter)"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setShowFindWidget(false);
                  textRef.current?.focus();
                }}
                style={{
                  background: "transparent",
                  color: "var(--text-strong)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  borderRadius: "4px",
                }}
                title="Close Find (Esc)"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bottom Row: List of Matches */}
          {findMatches.length > 0 && (
            <div
              ref={findMatchesRef}
              onScroll={handleMatchesScroll}
              className="workspace-table-scroll"
              style={{
                maxHeight: 180,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: 4,
              }}
            >
              {findMatches.slice(0, visibleMatchesCount).map((match, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setFindSelIdx(idx);
                    if (match.relPath && workspacePath && onFileSelect) {
                      const fullPath = workspacePath + "/" + match.relPath;
                      onFileSelect(fullPath);
                      setTimeout(() => {
                        window.dispatchEvent(
                          new CustomEvent("codeclub:scroll-to-line", {
                            detail: { line: match.line, focus: true },
                          }),
                        );
                      }, 100);
                      setShowFindWidget(false);
                    } else {
                      window.dispatchEvent(
                        new CustomEvent("codeclub:scroll-to-line", {
                          detail: { line: match.line, focus: true },
                        }),
                      );
                      setShowFindWidget(false);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "6px 8px",
                    background: idx === findSelIdx ? "rgba(255,255,255,0.06)" : "transparent",
                    border: "none",
                    borderRadius: "4px",
                    color: idx === findSelIdx ? "var(--text-strong)" : "var(--text-base)",
                    cursor: "pointer",
                    fontSize: 12,
                    textAlign: "left",
                  }}
                >
                  <span style={{ color: "var(--text-weaker)", fontWeight: 500, minWidth: 32 }}>
                    L{match.line}
                  </span>
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {match.relPath ? `[${match.relPath.split("/").pop()}] ` : ""}
                    {match.label}
                  </span>
                </button>
              ))}
              {findMatches.length > visibleMatchesCount && (
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-weaker)",
                    textAlign: "center",
                    padding: "4px 0",
                  }}
                >
                  Scroll down to load more of {findMatches.length} matches
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Dropdown de comandos barra diagonal y referencias de archivo */}
      {showDropdown && dropdownItems.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            bottom: "calc(100% + 1px)",
            left: 12,
            right: 12,
            maxHeight: 260,
            overflowY: "auto",
            background: "#111111",
            border: "1px solid rgba(255,255,255,0.08)",
            borderBottom: "none",
            borderRadius: "10px 10px 0 0",
            boxShadow: "0 -16px 40px rgba(0, 0, 0, 0.35)",
            zIndex: 100,
            padding: "6px",
          }}
        >
          {dropdownItems.map((item, idx) => (
            <button
              key={item.label}
              onClick={() => {
                void selectItem(item);
              }}
              onMouseEnter={() => setSelIdx(idx)}
              style={{
                width: "100%",
                padding: "8px 10px",
                cursor: "pointer",
                border: "none",
                borderRadius: 7,
                background: idx === selIdx ? "rgba(255,255,255,0.08)" : "transparent",
                color: idx === selIdx ? "var(--text-strong)" : "var(--text-base)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                fontSize: 12,
                textAlign: "left",
              }}
            >
              <span style={{ fontWeight: 500, color: "var(--text-strong)", whiteSpace: "nowrap" }}>
                {item.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-weaker)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "right",
                }}
              >
                {item.desc}
              </span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            border: "none",
            borderRadius: 0,
            background: "transparent",
            overflow: "visible",
            boxShadow: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              minHeight: 40,
              paddingLeft: 0,
              gap: 12,
              overflow: "hidden",
            }}
          >
            {pendingRag.map((item) => (
              <span
                key={item.block.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  flexShrink: 0,
                  fontSize: 15,
                  fontFamily: "var(--font-family-sans)",
                  lineHeight: "var(--line-height-large)",
                  color: "rgba(255, 255, 255, 0.85)",
                }}
              >
                <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
                  @{item.block.filePath.split("/").pop()}
                </span>
                <span
                  style={{
                    color: "var(--text-weaker)",
                    whiteSpace: "nowrap",
                    fontSize: 13,
                    marginLeft: 2,
                    opacity: 0.8,
                  }}
                >
                  ({item.block.code.length} ch)
                </span>
              </span>
            ))}
            <textarea
              ref={textRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={pendingRag.length || pendingFiles.length ? "" : getPlaceholder()}
              disabled={loading}
              style={{
                flex: 1,
                minWidth: 80,
                padding: "2px 42px 8px 0",
                borderRadius: 0,
                border: "none",
                background: "transparent",
                color: "var(--text-strong)",
                caretColor: workspaceColor || "var(--text-strong)",
                fontSize: 15,
                lineHeight: "var(--line-height-large)",
                resize: "none",
                outline: "none",
                maxHeight: "200px",
                fontFamily: "var(--font-family-sans)",
                verticalAlign: "baseline",
                ...({ caretShape: caretShape || "bar" } as any),
              }}
            />
          </div>
          {(() => {
            const swarmActive = swarm?.agents?.some(
              (a: any) => a.status === "running" || a.status === "tool",
            );
            const isBusy = swarmActive || loading;

            if (isBusy) {
              return (
                <button
                  onClick={() => {
                    if (swarmActive) swarm?.killAll();
                    if (loading) stop();
                  }}
                  title={swarmActive && loading ? "Stop All" : swarmActive ? "Pause Swarm" : "Stop"}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    background: "transparent",
                    color: "var(--text-strong)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                </button>
              );
            }

            return (
              <button
                onClick={submit}
                title="Send"
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: "transparent",
                  color: input.trim() ? "var(--text-strong)" : "var(--text-weaker)",
                  opacity: input.trim() ? 1 : 0.45,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
