import { useState, useEffect, useRef, useMemo } from "react";
import { readTextFile } from "../../utils/readLargeFile";
import { Header } from "./Header";
import { Content } from "./Content";
import { getLanguageFromPath } from "./utils";
import { s } from "./styles";

export function FileViewer({
  filePath,
  activeColor,
  onBack,
  workspacePath,
  hasOtherPanels,
}: {
  filePath: string;
  activeColor?: string;
  onBack: () => void;
  workspacePath?: string | null;
  hasOtherPanels?: boolean;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [gitOriginal, setGitOriginal] = useState<string | null>(null);
  const [diffStatus, setDiffStatus] = useState<string | null>(null);

  useEffect(() => {
    if (hasOtherPanels) {
      setShowDiff(false);
    }
  }, [hasOtherPanels]);

  const normalizedPath = useMemo(() => filePath.replace(/\\/g, "/"), [filePath]);

  const isImage = useMemo(() => {
    const ext = normalizedPath.split(".").pop()?.toLowerCase() || "";
    return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext);
  }, [normalizedPath]);

  const imageMime = useMemo(() => {
    const ext = normalizedPath.split(".").pop()?.toLowerCase() || "";
    if (ext === "svg") return "image/svg+xml";
    return `image/${ext}`;
  }, [normalizedPath]);

  const handleReset = () => {
    setContent(original);
  };

  const language = useMemo(() => getLanguageFromPath(normalizedPath), [normalizedPath]);

  const parentDir = useMemo(() => {
    const idx = normalizedPath.lastIndexOf("/");
    return idx >= 0 ? normalizedPath.slice(0, idx) : normalizedPath;
  }, [normalizedPath]);

  const fileName = useMemo(() => {
    return normalizedPath.split("/").pop() || "";
  }, [normalizedPath]);

  const dirtyRef = useRef(false);

  useEffect(() => {
    setContent(null);
    setOriginal(null);
    setError(false);
    setShowDiff(false);
    setGitOriginal(null);
    setDiffStatus(null);

    if (isImage) {
      window.api.readFileBase64(filePath).then((data: string | null) => {
        if (data === null) setError(true);
        else {
          setContent(data);
          setOriginal(data);
        }
      });
    } else {
      readTextFile(filePath).then((data: string | null) => {
        if (data === null) setError(true);
        else {
          setContent(data);
          setOriginal(data);
        }
      });
    }
  }, [filePath, isImage]);

  useEffect(() => {
    if (!parentDir || !fileName) return;
    window.api.watchDir(parentDir);
    const unlisten = window.api.onFsChange((dirPath, filename) => {
      if (dirPath === parentDir && filename === fileName && !dirtyRef.current) {
        readTextFile(filePath).then((data: string | null) => {
          if (data !== null) {
            setContent(data);
            setOriginal(data);
          }
        });
      }
    });
    return () => {
      window.api.unwatchDir(parentDir);
      unlisten();
    };
  }, [filePath, parentDir, fileName]);

  useEffect(() => {
    const data = { filePath, content };
    (window as any).__activeFile = data;
    window.dispatchEvent(
      new CustomEvent("codeclub:active-file-changed", {
        detail: data,
      }),
    );
    return () => {
      if ((window as any).__activeFile?.filePath === filePath) {
        (window as any).__activeFile = null;
      }
      window.dispatchEvent(
        new CustomEvent("codeclub:active-file-changed", {
          detail: null,
        }),
      );
    };
  }, [filePath, content]);

  const dirty = content !== original;
  dirtyRef.current = dirty;

  const handleSave = async () => {
    if (content === null) return;
    setSaving(true);
    const ok = await window.api.writeFile(filePath, content);
    if (ok) {
      setOriginal(content);
      const savedFiles: Set<string> = (window as any).__codeclubSavedFiles ?? new Set<string>();
      savedFiles.add(filePath);
      (window as any).__codeclubSavedFiles = savedFiles;
      window.dispatchEvent(
        new CustomEvent("codeclub:file-saved", { detail: { filePath, workspacePath } }),
      );
    }
    setSaving(false);
  };

  const toggleDiff = async () => {
    if (showDiff) {
      setShowDiff(false);
      setDiffStatus(null);
      return;
    }
    if (!workspacePath) {
      setDiffStatus("Open a workspace to compare changes");
      return;
    }
    const result = await window.api.gitFileOriginal(workspacePath, filePath);
    if (!result.ok) {
      setDiffStatus("Git diff unavailable");
      return;
    }
    setGitOriginal(result.content);
    setDiffStatus(result.status === "untracked" ? "New file" : null);
    setShowDiff(true);
  };

  if (error) {
    return (
      <div style={s.container}>
        <Header
          fileName={fileName}
          filePath={normalizedPath}
          dirty={false}
          saving={false}
          _showDiff={false}
          onBack={onBack}
          onSave={() => {}}
          _onToggleDiff={() => {}}
          onReset={() => {}}
          activeColor={activeColor}
        />
        <div style={s.error}>Error loading file. It may be too large or binary.</div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <Header
        fileName={fileName}
        filePath={normalizedPath}
        dirty={dirty}
        saving={saving}
        _showDiff={showDiff}
        onBack={onBack}
        onSave={handleSave}
        _onToggleDiff={toggleDiff}
        onReset={handleReset}
        activeColor={activeColor}
      />
      {diffStatus && (
        <div
          style={{
            padding: "4px 12px",
            fontSize: 11,
            color: "var(--text-accent)",
            background: "var(--surface-inset-base)",
          }}
        >
          {diffStatus}
        </div>
      )}
      <Content
        isImage={isImage}
        imageMime={imageMime}
        content={content}
        _original={original}
        gitOriginal={gitOriginal}
        showDiff={showDiff}
        language={language}
        filePath={filePath}
        workspacePath={workspacePath || null}
        setContent={setContent}
      />
    </div>
  );
}
