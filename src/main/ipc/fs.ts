import { ipcMain, app } from "electron";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  renameSync,
  rmSync,
  cpSync,
} from "fs";
import type { StructuralNode } from "../../shared/structuralNodes";
import { extname, join, relative, resolve } from "path";
import { execFile } from "child_process";
import { searchIndex } from "../indexer";
import { getScanBinaryPath } from "../indexer/scanner";
import { registerCommandHandlers } from "./fs/commands";
import { registerWatcherHandlers } from "./fs/watcher";
import { registerSearchHandlers } from "./fs/search";
import { semanticNodeHash, structuralNodeId } from "../../shared/structuralNodes";
import type {
  TopographicMutationRequest,
  TopographicReadRequest,
} from "../../shared/topographicNodes";
import {
  diffTopographicTreesAsync,
  mutateTopographic,
  readTopographicContent,
} from "./fs/topographic";
import { ensureTopographicCache } from "./fs/graphCache";
import { ipcWarn, normalizeIpcPath } from "./validation";

function decomposeFileToSections(filePath: string, content: string): StructuralNode[] {
  const lines = content.split("\n");
  const ext = extname(filePath).toLowerCase();
  const sections: StructuralNode[] = [];
  const push = (name: string, type: StructuralNode["type"], start: number, end: number) => {
    const block = lines.slice(start, end + 1).join("\n");
    if (!block.trim()) return;
    sections.push({
      id: structuralNodeId(filePath, type, name),
      name,
      type,
      ancestors: [],
      startLine: start + 1,
      endLine: end + 1,
      content: block,
      baseHash: semanticNodeHash(block),
    });
  };
  if (
    [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".py",
      ".rs",
      ".go",
      ".c",
      ".h",
      ".cpp",
      ".hpp",
      ".java",
      ".cs",
      ".rb",
    ].includes(ext)
  ) {
    const declaration =
      /^\s*(?:export\s+)?(?:async\s+)?(?:(class|interface|struct|enum|trait)\s+([A-Za-z_$][\w$]*)|(?:function|def|fn|func)\s+([A-Za-z_$][\w$]*))/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(declaration);
      if (!match) continue;
      const kind =
        match[1] === "class"
          ? "class"
          : match[1] === "interface"
            ? "interface"
            : match[1]
              ? "other"
              : "function";
      let end = lines.length - 1;
      for (let j = i + 1; j < lines.length; j++) {
        if (declaration.test(lines[j])) {
          end = j - 1;
          break;
        }
      }
      push(match[2] ?? match[3], kind, i, end);
    }
    if (sections.length > 0) return sections;
  }
  if (ext === ".md") {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
      if (!match) continue;
      let end = lines.length - 1;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#{1,6}\s+/.test(lines[j])) {
          end = j - 1;
          break;
        }
      }
      push(match[2].trim().slice(0, 40), "section", i, end);
    }
    if (sections.length > 0) return sections;
  }
  if ([".json", ".yaml", ".yml", ".toml"].includes(ext)) {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^["']?([A-Za-z0-9_.-]+)["']?\s*[:=]/);
      if (!match) continue;
      let end = lines.length - 1;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^["']?([A-Za-z0-9_.-]+)["']?\s*[:=]/.test(lines[j])) {
          end = j - 1;
          break;
        }
      }
      push(match[1], "section", i, end);
    }
    if (sections.length > 0) return sections;
  }
  const blockSize = 50;
  for (let start = 0; start < lines.length; ) {
    const end = Math.min(start + blockSize, lines.length) - 1;
    push(`block-${start + 1}:${end + 1}`, "block", start, end);
    if (end >= lines.length - 1) break;
    start += blockSize;
  }
  return sections;
}

export function registerFsHandlers(): void {
  registerCommandHandlers();
  registerWatcherHandlers();
  registerSearchHandlers();
  const readStructuralNodes = async (filePath: string): Promise<StructuralNode[]> => {
    const rust = await runEngineJson<StructuralNode[]>(["codeclub-nodes", filePath]);
    return Array.isArray(rust)
      ? rust
      : decomposeFileToSections(filePath, readFileSync(filePath, "utf-8"));
  };
  ipcMain.handle("fs:topographicTree", (_event, workspacePath: string) =>
    ensureTopographicCache(workspacePath),
  );
  ipcMain.handle(
    "fs:topographicDiff",
    async (_event, workspacePath: string, oldTree: any[], newTree: any[]) => {
      try {
        return await diffTopographicTreesAsync(workspacePath, oldTree, newTree);
      } catch {
        return [];
      }
    },
  );
  ipcMain.handle("fs:topographicRead", (_event, request: TopographicReadRequest) =>
    readTopographicContent(request.workspacePath, request, readStructuralNodes),
  );
  ipcMain.handle("fs:topographicMutate", async (_event, request: TopographicMutationRequest) => {
    try {
      return await mutateTopographic(request.workspacePath, request.mutation, readStructuralNodes);
    } catch (error) {
      const message = (error as Error).message;
      const [, currentHash] = message.match(/^hash-conflict:(.+)$/) ?? [];
      return { ok: false, error: currentHash ? "hash-conflict" : message, currentHash };
    }
  });
  ipcMain.handle("fs:listDrives", () => {
    const drives: string[] = [];
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      try {
        const root = letter + ":\\";
        statSync(root);
        drives.push(root);
      } catch {
        /* skip */
      }
    }
    return drives;
  });

  ipcMain.handle("fs:writeFile", async (_event, filePath: string, content: string) => {
    try {
      mkdirSync(require("path").dirname(filePath), { recursive: true });
      const binaryPath = getScanBinaryPath();
      if (!existsSync(binaryPath)) {
        writeFileSync(filePath, content, "utf-8");
        return true;
      }
      return new Promise<boolean>((resolve) => {
        const child = execFile(binaryPath, ["io", "write-file", filePath], (error) => {
          resolve(!error);
        });
        child.stdin?.write(content);
        child.stdin?.end();
      });
    } catch {
      return false;
    }
  });

  ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
    try {
      const binaryPath = getScanBinaryPath();
      if (!existsSync(binaryPath)) return readFileSync(filePath, "utf-8");
      return new Promise<string | null>((resolve) => {
        execFile(
          binaryPath,
          ["io", "read-file", filePath],
          { maxBuffer: 50 * 1024 * 1024 },
          (error, stdout) => {
            if (error) resolve(null);
            else resolve(stdout);
          },
        );
      });
    } catch {
      return null;
    }
  });

  const runEngineJson = <T>(args: string[]): Promise<T | null> =>
    new Promise((resolveResult) => {
      const binaryPath = getScanBinaryPath();
      if (!existsSync(binaryPath)) return resolveResult(null);
      execFile(binaryPath, args, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout) => {
        if (error) return resolveResult(null);
        try {
          resolveResult(JSON.parse(stdout) as T);
        } catch {
          resolveResult(null);
        }
      });
    });

  ipcMain.handle(
    "fs:readRange",
    (_event, filePath: string, offset = 0, length = 256 * 1024, knownHash = "", plain = false) => {
      const cacheDir = join(app.getPath("userData"), "file-cache");
      return runEngineJson([
        "read-range",
        filePath,
        String(offset),
        String(length),
        knownHash,
        cacheDir,
        plain ? "plain" : "compressed",
      ]);
    },
  );

  ipcMain.handle("fs:fileDiff", (_event, filePath: string, previousHash: string) => {
    const cacheDir = join(app.getPath("userData"), "file-cache");
    return runEngineJson(["diff", filePath, previousHash, cacheDir]);
  });

  ipcMain.handle("fs:readFileBase64", (_event, filePath: string) => {
    let finalPath = filePath;
    try {
      if (typeof filePath !== "string" || !filePath.trim() || filePath.includes("\0")) return null;
      if (filePath.startsWith("resources/") || filePath.startsWith("resources\\")) {
        finalPath = app.isPackaged
          ? join(process.resourcesPath, filePath)
          : join(process.cwd(), filePath);
      } else {
        finalPath = normalizeIpcPath(filePath, "filePath");
      }
      return readFileSync(finalPath).toString("base64");
    } catch (e: any) {
      ipcWarn("fs:readFileBase64", e);
      return null;
    }
  });

  ipcMain.handle("fs:copyFile", (_event, src: string, dest: string) => {
    try {
      cpSync(normalizeIpcPath(src, "src"), normalizeIpcPath(dest, "dest"), { recursive: true });
      return true;
    } catch (error) {
      ipcWarn("fs:copyFile", error);
      return false;
    }
  });

  ipcMain.handle("git:fileOriginal", async (_event, workspacePath: string, filePath: string) => {
    const root = resolve(workspacePath);
    const target = resolve(filePath);
    const relativePath = relative(root, target).replace(/\\/g, "/");
    if (!relativePath || relativePath.startsWith("../") || relativePath === "..") {
      return { ok: false, content: "", status: "outside-workspace" };
    }
    return new Promise((resolveResult) => {
      execFile(
        "git",
        ["show", `HEAD:${relativePath}`],
        { cwd: root, timeout: 10000, maxBuffer: 5 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (!err) {
            resolveResult({ ok: true, content: stdout, status: "tracked" });
            return;
          }
          const message = stderr.toLowerCase();
          if (
            message.includes("does not exist in") ||
            message.includes("exists on disk, but not in")
          ) {
            resolveResult({ ok: true, content: "", status: "untracked" });
            return;
          }
          resolveResult({ ok: false, content: "", status: "unavailable" });
        },
      );
    });
  });

  ipcMain.on("fs:readFileSync", (event, filePath: string) => {
    try {
      event.returnValue = readFileSync(filePath, "utf-8");
    } catch {
      event.returnValue = null;
    }
  });

  ipcMain.on("fs:readDirSync", (event, dirPath: string) => {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      event.returnValue = entries
        .map((e) => ({
          name: e.name,
          path: join(dirPath, e.name).replace(/\\/g, "/"),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
    } catch {
      event.returnValue = [];
    }
  });

  ipcMain.handle("fs:readDir", (_event, dirPath: string) => {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      return entries
        .map((e) => ({
          name: e.name,
          path: join(dirPath, e.name).replace(/\\/g, "/"),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
    } catch {
      return [];
    }
  });

  ipcMain.handle("fs:recentFiles", (_event, workspacePath: string, limit = 3) => {
    const skip = new Set(["node_modules", ".git", "dist", "out"]);
    const files: { path: string; name: string; modifiedAt: number }[] = [];
    const walk = (dir: string, depth: number) => {
      if (depth > 8 || files.length > 2000) return;
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (skip.has(entry.name)) continue;
        const path = join(dir, entry.name);
        try {
          if (entry.isDirectory()) walk(path, depth + 1);
          else {
            const stat = statSync(path);
            files.push({
              path: path.replace(/\\/g, "/"),
              name: entry.name,
              modifiedAt: stat.mtimeMs,
            });
          }
        } catch {}
      }
    };
    walk(workspacePath, 0);
    return files.sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, limit);
  });

  ipcMain.handle("fs:listNodes", async (_event, filePath: string) => {
    try {
      return await readStructuralNodes(filePath);
    } catch {
      return { ok: false, reason: "read-failed" };
    }
  });

  ipcMain.handle("fs:appendNode", async (_event, filePath: string, content: string) => {
    try {
      const rust = await runEngineJson<{ ok: boolean; reason?: string }>([
        "codeclub-append",
        filePath,
        content,
      ]);
      if (rust) return rust;
      const current = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
      const sep = current.endsWith("\n") || current.length === 0 ? "" : "\n";
      writeFileSync(filePath, `${current}${sep}${content.trimEnd()}\n`, "utf-8");
      return { ok: true };
    } catch {
      return { ok: false, reason: "append-failed" };
    }
  });

  ipcMain.handle(
    "fs:replaceNodeRange",
    async (_event, filePath: string, startLine: number, endLine: number, content: string) => {
      try {
        const rust = await runEngineJson<{ ok: boolean; reason?: string }>([
          "codeclub-replace-range",
          filePath,
          String(startLine),
          String(endLine),
          content,
        ]);
        if (rust) return rust;
        const current = readFileSync(filePath, "utf-8");
        const lines = current.split("\n");
        if (startLine < 1 || endLine < startLine || startLine > lines.length)
          return { ok: false, reason: "range-out-of-bounds" };
        const replacement = content.trimEnd();
        const next = [
          ...lines.slice(0, startLine - 1),
          ...(replacement ? replacement.split("\n") : []),
          ...lines.slice(endLine),
        ].join("\n");
        writeFileSync(filePath, next, "utf-8");
        return { ok: true };
      } catch {
        return { ok: false, reason: "replace-range-failed" };
      }
    },
  );

  ipcMain.handle("fs:createFile", (_event, filePath: string) => {
    try {
      writeFileSync(normalizeIpcPath(filePath, "filePath"), "", "utf-8");
      return true;
    } catch (error) {
      ipcWarn("fs:createFile", error);
      return false;
    }
  });

  ipcMain.handle("fs:createDir", (_event, dirPath: string) => {
    try {
      mkdirSync(normalizeIpcPath(dirPath, "dirPath"), { recursive: true });
      return true;
    } catch (error) {
      ipcWarn("fs:createDir", error);
      return false;
    }
  });

  ipcMain.handle("fs:rename", (_event, oldPath: string, newPath: string) => {
    try {
      renameSync(normalizeIpcPath(oldPath, "oldPath"), normalizeIpcPath(newPath, "newPath"));
      return true;
    } catch (error) {
      ipcWarn("fs:rename", error);
      return false;
    }
  });

  ipcMain.handle("fs:delete", async (_event, targetPath: string) => {
    try {
      const safeTarget = normalizeIpcPath(targetPath, "targetPath");
      const binaryPath = getScanBinaryPath();
      if (!existsSync(binaryPath)) {
        rmSync(safeTarget, { recursive: true, force: true });
        return true;
      }
      return new Promise<boolean>((resolve) => {
        execFile(binaryPath, ["io", "delete-file", safeTarget], (error) => {
          resolve(!error);
        });
      });
    } catch (error) {
      ipcWarn("fs:delete", error);
      return false;
    }
  });
  ipcMain.handle(
    "fs:editFile",
    async (_event, filePath: string, oldContent: string, newContent: string) => {
      try {
        const binaryPath = getScanBinaryPath();
        if (!existsSync(binaryPath)) {
          const current = readFileSync(filePath, "utf-8");
          const at = current.indexOf(oldContent);
          if (at < 0 || current.indexOf(oldContent, at + oldContent.length) >= 0)
            return { ok: false, error: "oldContent must occur exactly once." };
          writeFileSync(
            filePath,
            current.slice(0, at) + newContent + current.slice(at + oldContent.length),
            "utf-8",
          );
          return { ok: true };
        }
        return new Promise<{ ok: boolean; error?: string }>((resolve) => {
          const child = execFile(
            binaryPath,
            ["io", "edit-file", filePath],
            (error, stdout, stderr) => {
              if (error) {
                resolve({ ok: false, error: stderr || error.message || "Failed to edit" });
              } else {
                resolve({ ok: true });
              }
            },
          );
          child.stdin?.write(JSON.stringify({ oldContent, content: newContent }));
          child.stdin?.end();
        });
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  );

  ipcMain.handle("fs:exists", (_event, targetPath: string) => {
    try {
      return existsSync(normalizeIpcPath(targetPath, "targetPath"));
    } catch (error) {
      ipcWarn("fs:exists", error);
      return false;
    }
  });

  ipcMain.handle(
    "fs:rustSearch",
    async (_event, workspacePath: string, query: string, topK?: number) => {
      return searchIndex(workspacePath, query, topK);
    },
  );
}
