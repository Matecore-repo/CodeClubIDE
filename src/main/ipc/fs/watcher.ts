import { BrowserWindow, ipcMain } from "electron";
import { watch, type FSWatcher } from "fs";
import { join, relative } from "path";
import { getCurrentWorkspace } from "../../indexer";
import { onFileChanged } from "./graphCache";

const watchers = new Map<string, FSWatcher>();

function emitFsChange(dirPath: string, filename: string): void {
  const workspacePath = getCurrentWorkspace();
  if (workspacePath) {
    const fullPath = join(dirPath, filename);
    const rel = relative(workspacePath, fullPath);
    if (!rel.startsWith("..") && !rel.startsWith(".")) {
      onFileChanged(workspacePath, fullPath);
    }
  }
  BrowserWindow.getAllWindows().forEach((window) =>
    window.webContents.send("fs:change", dirPath, filename),
  );
}

export function registerWatcherHandlers(): void {
  ipcMain.handle("fs:watchDir", (_event, dirPath: string) => {
    if (watchers.has(dirPath)) return;
    try {
      const watcher = watch(dirPath, (_eventType, filename) => {
        if (!filename) return;
        emitFsChange(dirPath, filename);
      });
      watchers.set(dirPath, watcher);
    } catch {
      /* path may not exist */
    }
  });

  ipcMain.handle("fs:unwatchDir", (_event, dirPath: string) => {
    watchers.get(dirPath)?.close();
    watchers.delete(dirPath);
  });
}
