import { ipcMain } from "electron";
import { searchIndex, reindex, getIndexStatus, openWorkspace, closeWorkspace } from "../indexer";
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

  ipcMain.handle("graph:getEdges", async (_event, workspacePath: string) => {
    return ensureGraphCache(workspacePath);
  });
}
