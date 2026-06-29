import { watch, FSWatcher } from "fs";
import { existsSync } from "fs";
import { join, relative } from "path";
import { isIndexableFile } from "./chunker";

export type FileChange = { type: "upsert" | "remove"; filePath: string };
type ChangeCallback = (change: FileChange) => void;

interface WatcherEntry {
  watcher: FSWatcher;
  debounceTimers: Map<string, NodeJS.Timeout>;
}

const activeWatchers = new Map<string, WatcherEntry>();

export function startWatching(workspacePath: string, onChange: ChangeCallback): void {
  stopWatching(workspacePath);

  const entry: WatcherEntry = {
    watcher: null as unknown as FSWatcher,
    debounceTimers: new Map(),
  };

  const debouncedOnChange = (change: FileChange) => {
    const filePath = change.filePath;
    const existing = entry.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);
    entry.debounceTimers.set(
      filePath,
      setTimeout(() => {
        entry.debounceTimers.delete(filePath);
        onChange(change);
      }, 1000),
    );
  };

  try {
    const watcher = watch(workspacePath, { recursive: true });
    watcher.on("change", (_eventType: string, filename: string | null) => {
      if (!filename) return;

      const fullPath = join(workspacePath, filename);
      const relPath = relative(workspacePath, fullPath).replace(/\\/g, "/");
      const parts = relPath.split("/");

      for (const part of parts) {
        if (part.startsWith(".") || part === "node_modules") return;
      }

      if (!isIndexableFile(fullPath)) return;
      debouncedOnChange({ type: existsSync(fullPath) ? "upsert" : "remove", filePath: fullPath });
    });

    entry.watcher = watcher;
    activeWatchers.set(workspacePath, entry);
  } catch (err) {
    console.warn(`[indexer] Failed to watch ${workspacePath}:`, err);
  }
}

export function stopWatching(workspacePath: string): void {
  const entry = activeWatchers.get(workspacePath);
  if (!entry) return;

  try {
    entry.watcher.close();
  } catch {
    /* ignore */
  }

  for (const timer of Array.from(entry.debounceTimers.values())) {
    clearTimeout(timer);
  }

  activeWatchers.delete(workspacePath);
}

export function stopAllWatching(): void {
  for (const key of Array.from(activeWatchers.keys())) {
    stopWatching(key);
  }
}
