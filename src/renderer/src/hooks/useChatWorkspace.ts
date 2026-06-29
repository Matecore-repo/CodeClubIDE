import { useEffect, useMemo, useState } from "react";

export function useChatWorkspace(workspacePath?: string | null, filePath?: string | null) {
  const [skills, setSkills] = useState<{ name: string; description: string }[]>([]);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!workspacePath) {
      setSkills([]);
      return;
    }
    window.api
      .getSkills(workspacePath)
      .then((items) => setSkills(items.map(({ name, description }) => ({ name, description }))))
      .catch(() => setSkills([]));
  }, [workspacePath]);

  // Watch for workspace file changes to increment the revision
  useEffect(() => {
    if (!workspacePath) return;

    window.api.watchDir(workspacePath).catch(() => {});

    const listener = (_dirPath: string, filename: string) => {
      const parts = filename.split(/[\\/]/);
      if (
        parts.some((part) => part.startsWith(".") || ["node_modules", "dist", "out"].includes(part))
      ) {
        return;
      }
      setRevision((prev) => prev + 1);
    };

    const unsubscribe = window.api.onFsChange(listener);

    return () => {
      window.api.unwatchDir(workspacePath).catch(() => {});
      if (unsubscribe) unsubscribe();
    };
  }, [workspacePath]);

  const fileContext = useMemo(() => {
    if (!filePath) return "";
    try {
      const content = window.api.readFileContent(filePath);
      return content ? `${filePath}:\n\`\`\`\n${content}\n\`\`\`` : "";
    } catch {
      return "";
    }
  }, [filePath]);

  const workspaceTree = useMemo(() => {
    if (!workspacePath) return "";
    const lines: string[] = [];
    const walk = (dir: string, depth: number) => {
      if (depth > 1) return;
      for (const entry of window.api.readDirSync(dir)) {
        if (entry.name.startsWith(".") || ["node_modules", "out"].includes(entry.name)) continue;
        lines.push(`${"  ".repeat(depth)}${entry.isDirectory ? "[DIR]" : "[FILE]"} ${entry.name}`);
        if (entry.isDirectory) walk(entry.path, depth + 1);
      }
    };
    try {
      walk(workspacePath, 0);
    } catch {
      return "";
    }
    return lines.join("\n");
  }, [workspacePath, revision]);

  const files = useMemo(() => {
    if (!workspacePath) return [];
    const result: { name: string; path: string; relativePath: string }[] = [];
    const walk = (dir: string) => {
      if (result.length >= 500) return;
      for (const entry of window.api.readDirSync(dir)) {
        if (entry.name.startsWith(".") || ["node_modules", "dist", "out"].includes(entry.name))
          continue;
        if (entry.isDirectory) walk(entry.path);
        else
          result.push({
            name: entry.name,
            path: entry.path,
            relativePath: entry.path
              .replace(workspacePath, "")
              .replace(/^[\\/]/, "")
              .replace(/\\/g, "/"),
          });
      }
    };
    try {
      walk(workspacePath);
    } catch {
      /* unreadable workspace */
    }
    return result;
  }, [workspacePath, revision]);

  return { skills, fileContext, workspaceTree, files };
}
