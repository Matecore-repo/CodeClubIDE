import { app, ipcMain } from "electron";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join, relative, resolve } from "path";

const MAX_CHECKPOINTS = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface FileSnapshot {
  path: string;
  existed: boolean;
  content?: string;
  skipped?: string;
}

interface Checkpoint {
  id: string;
  sessionId: string;
  workspacePath: string;
  createdAt: string;
  label: string;
  messages: unknown[];
  files: FileSnapshot[];
}

function storePath(): string {
  const dir = join(app.getPath("userData"), "checkpoints");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "checkpoints.json");
}

function readAll(): Checkpoint[] {
  try {
    return JSON.parse(readFileSync(storePath(), "utf8")) as Checkpoint[];
  } catch {
    return [];
  }
}

function writeAll(items: Checkpoint[]): void {
  const target = storePath();
  const temp = `${target}.tmp`;
  writeFileSync(temp, JSON.stringify(items));
  renameSync(temp, target);
}

function safePath(workspacePath: string, filePath: string): string {
  const workspace = resolve(workspacePath);
  const target = resolve(workspace, filePath);
  const rel = relative(workspace, target);
  if (rel.startsWith("..") || resolve(workspace, rel) !== target)
    throw new Error("Path outside workspace");
  return target;
}

export function registerCheckpointHandlers(): void {
  ipcMain.handle(
    "checkpoint:create",
    (_event, sessionId: string, workspacePath: string, label: string, messages: unknown[]) => {
      const checkpoint: Checkpoint = {
        id: crypto.randomUUID(),
        sessionId,
        workspacePath: resolve(workspacePath),
        createdAt: new Date().toISOString(),
        label,
        messages,
        files: [],
      };
      const others = readAll();
      const same = others.filter((item) => item.sessionId === sessionId);
      const keepIds = new Set(same.slice(0, MAX_CHECKPOINTS - 1).map((item) => item.id));
      writeAll([
        checkpoint,
        ...others.filter((item) => item.sessionId !== sessionId || keepIds.has(item.id)),
      ]);
      return checkpoint.id;
    },
  );

  ipcMain.handle("checkpoint:capture", (_event, checkpointId: string, filePath: string) => {
    const items = readAll();
    const checkpoint = items.find((item) => item.id === checkpointId);
    if (!checkpoint) return { captured: false, reason: "Checkpoint not found" };
    const target = safePath(checkpoint.workspacePath, filePath);
    if (checkpoint.files.some((item) => item.path === target)) return { captured: true };
    const snapshot: FileSnapshot = { path: target, existed: existsSync(target) };
    if (snapshot.existed) {
      const stat = statSync(target);
      if (!stat.isFile()) snapshot.skipped = "Not a file";
      else if (stat.size > MAX_FILE_SIZE) snapshot.skipped = "File exceeds 10 MB";
      else {
        const data = readFileSync(target);
        if (data.includes(0)) snapshot.skipped = "Binary file";
        else snapshot.content = data.toString("base64");
      }
    }
    checkpoint.files.push(snapshot);
    writeAll(items);
    return { captured: !snapshot.skipped, reason: snapshot.skipped };
  });

  ipcMain.handle("checkpoint:list", (_event, sessionId: string, workspacePath?: string) =>
    readAll()
      .filter(
        (item) =>
          item.sessionId === sessionId ||
          (!item.sessionId && workspacePath && item.workspacePath === resolve(workspacePath)),
      )
      .map(({ workspacePath: _workspace, ...item }) => item),
  );

  ipcMain.handle("checkpoint:get", (_event, checkpointId: string) => {
    return readAll().find((item) => item.id === checkpointId) || null;
  });

  ipcMain.handle("checkpoint:restore", (_event, checkpointId: string) => {
    const checkpoint = readAll().find((item) => item.id === checkpointId);
    if (!checkpoint) throw new Error("Checkpoint not found");
    const errors: string[] = [];
    for (const file of checkpoint.files) {
      if (file.skipped) {
        errors.push(`${file.path}: ${file.skipped}`);
        continue;
      }
      try {
        const target = safePath(checkpoint.workspacePath, file.path);
        if (!file.existed) {
          if (existsSync(target)) rmSync(target, { recursive: true, force: true });
        } else {
          mkdirSync(dirname(target), { recursive: true });
          const temp = `${target}.codeclub-rollback`;
          const backup = `${target}.codeclub-backup`;
          writeFileSync(temp, Buffer.from(file.content ?? "", "base64"));
          if (existsSync(backup)) rmSync(backup, { force: true });
          if (existsSync(target)) renameSync(target, backup);
          try {
            renameSync(temp, target);
            if (existsSync(backup)) rmSync(backup, { force: true });
          } catch (error) {
            if (existsSync(backup)) renameSync(backup, target);
            throw error;
          }
        }
      } catch (error) {
        errors.push(`${file.path}: ${(error as Error).message}`);
      }
    }
    return { messages: checkpoint.messages, errors };
  });

  ipcMain.handle("checkpoint:delete", (_event, checkpointId: string) => {
    writeAll(readAll().filter((item) => item.id !== checkpointId));
  });
}
