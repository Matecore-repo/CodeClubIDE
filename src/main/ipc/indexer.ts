import { ipcMain } from "electron";
import { searchIndex, reindex, getIndexStatus, openWorkspace, closeWorkspace } from "../indexer";
import { getArchitectureSummary } from "../indexer/architecture";
import { queryGraph } from "../indexer/graphQuery";
import { exportGraphSnapshot, importGraphSnapshot } from "../indexer/graphStore";
import { analyzeImpact } from "../indexer/impact";
import { ensureGraphCache } from "./fs/graphCache";

export function registerIndexerHandlers(): void {
  ipcMain.handle("indexing:open", (_event, workspacePath: string) => {
    openWorkspace(workspacePath);
  });

  ipcMain.handle("indexing:close", () => {
    closeWorkspace();
  });

  ipcMain.handle(
    "indexing:search",
    async (_event, workspacePath: string, query: string, topK?: number) => {
      return searchIndex(workspacePath, query, topK);
    },
  );

  ipcMain.handle("indexing:reindex", async (_event, workspacePath: string, filePath?: string) => {
    await reindex(workspacePath, filePath);
  });

  ipcMain.handle("indexing:status", (_event, workspacePath: string) => {
    return getIndexStatus(workspacePath);
  });

  ipcMain.handle("indexing:architecture", (_event, workspacePath: string) => {
    return getArchitectureSummary(workspacePath);
  });

  ipcMain.handle("indexing:impact", (_event, workspacePath: string, targetPath: string) => {
    return analyzeImpact(workspacePath, targetPath);
  });

  ipcMain.handle("indexing:queryGraph", (_event, workspacePath: string, query: unknown) => {
    return queryGraph(workspacePath, query && typeof query === "object" ? query : {});
  });

  ipcMain.handle("indexing:exportGraphSnapshot", (_event, workspacePath: string) => {
    return exportGraphSnapshot(workspacePath);
  });

  ipcMain.handle("indexing:importGraphSnapshot", (_event, workspacePath: string) => {
    return importGraphSnapshot(workspacePath);
  });

  ipcMain.handle("graph:getEdges", async (_event, workspacePath: string) => {
    return ensureGraphCache(workspacePath);
  });
}
