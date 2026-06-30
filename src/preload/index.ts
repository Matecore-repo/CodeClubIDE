import { contextBridge, ipcRenderer } from "electron";

ipcRenderer.setMaxListeners(30);

const api = {
  platform: process.platform,

  storeGet: (name: string, key: string) => ipcRenderer.invoke("store:get", name, key),

  storeSet: (name: string, key: string, value: unknown) =>
    ipcRenderer.invoke("store:set", name, key, value),

  openLink: (url: string) => ipcRenderer.invoke("system:openLink", url),

  openEmail: (email: string) => ipcRenderer.invoke("system:openEmail", email),

  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke("system:notification", title, body),

  proxyFetch: (url: string, options?: any) => ipcRenderer.invoke("system:fetch", url, options),

  proxyFetchStream: (url: string, options?: any) =>
    ipcRenderer.invoke("system:fetchStream", url, options),

  onStreamData: (id: string, callback: (data: string) => void) => {
    const h = (_event: Electron.IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on(`stream:data:${id}`, h);
    return () => ipcRenderer.removeListener(`stream:data:${id}`, h);
  },

  onStreamDone: (id: string, callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on(`stream:done:${id}`, h);
    return () => ipcRenderer.removeListener(`stream:done:${id}`, h);
  },

  onStreamError: (id: string, callback: (err: string) => void) => {
    const h = (_event: Electron.IpcRendererEvent, err: string) => callback(err);
    ipcRenderer.on(`stream:error:${id}`, h);
    return () => ipcRenderer.removeListener(`stream:error:${id}`, h);
  },

  getVersion: () => ipcRenderer.invoke("app:version"),

  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("window:maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  windowIsMaximized: () => ipcRenderer.invoke("window:isMaximized"),

  listDrives: () => ipcRenderer.invoke("fs:listDrives"),
  readDir: (dirPath: string) => ipcRenderer.invoke("fs:readDir", dirPath),
  readDirSync: (dirPath: string) =>
    ipcRenderer.sendSync("fs:readDirSync", dirPath) as {
      name: string;
      path: string;
      isDirectory: boolean;
    }[],
  recentFiles: (workspacePath: string, limit?: number) =>
    ipcRenderer.invoke("fs:recentFiles", workspacePath, limit),
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
  selectFiles: () => ipcRenderer.invoke("dialog:selectFiles"),
  readFile: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  readFileRange: (
    filePath: string,
    offset?: number,
    length?: number,
    knownHash?: string,
    plain?: boolean,
  ) => ipcRenderer.invoke("fs:readRange", filePath, offset, length, knownHash, plain),
  fileDiff: (filePath: string, previousHash: string) =>
    ipcRenderer.invoke("fs:fileDiff", filePath, previousHash),
  readFileBase64: (filePath: string) => ipcRenderer.invoke("fs:readFileBase64", filePath),
  readFileContent: (filePath: string) => ipcRenderer.sendSync("fs:readFileSync", filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:writeFile", filePath, content),
  listNodes: (filePath: string) => ipcRenderer.invoke("fs:listNodes", filePath),
  topographicTree: (workspacePath: string) =>
    ipcRenderer.invoke("fs:topographicTree", workspacePath),
  topographicDiffAsync: (workspacePath: string, oldTree: any[], newTree: any[]) =>
    ipcRenderer.invoke("fs:topographicDiff", workspacePath, oldTree, newTree),
  topographicRead: (request: any) => ipcRenderer.invoke("fs:topographicRead", request),
  topographicMutate: (request: any) => ipcRenderer.invoke("fs:topographicMutate", request),
  appendNode: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:appendNode", filePath, content),
  replaceNodeRange: (filePath: string, startLine: number, endLine: number, content: string) =>
    ipcRenderer.invoke("fs:replaceNodeRange", filePath, startLine, endLine, content),
  copyFile: (src: string, dest: string) => ipcRenderer.invoke("fs:copyFile", src, dest),
  gitFileOriginal: (workspacePath: string, filePath: string) =>
    ipcRenderer.invoke("git:fileOriginal", workspacePath, filePath),

  createTerminal: (cwd: string, useWsl?: boolean, profile?: string) =>
    ipcRenderer.invoke("terminal:create", cwd, useWsl, profile),
  writeToTerminal: (id: string, data: string) => ipcRenderer.invoke("terminal:write", id, data),
  killTerminal: (id: string) => ipcRenderer.invoke("terminal:kill", id),
  resizeTerminal: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke("terminal:resize", id, cols, rows),
  attachTerminal: (id: string) => ipcRenderer.invoke("terminal:attach", id),
  debugStart: (config: any) => ipcRenderer.invoke("debug:start", config),
  debugRequest: (workspacePath: string, command: string, args?: Record<string, unknown>) =>
    ipcRenderer.invoke("debug:request", workspacePath, command, args),
  debugStop: (workspacePath: string) => ipcRenderer.invoke("debug:stop", workspacePath),
  debugState: (workspacePath: string) => ipcRenderer.invoke("debug:state", workspacePath),
  checkpointCreate: (
    sessionId: string,
    workspacePath: string,
    label: string,
    messages: unknown[],
  ) => ipcRenderer.invoke("checkpoint:create", sessionId, workspacePath, label, messages),
  checkpointCapture: (checkpointId: string, filePath: string) =>
    ipcRenderer.invoke("checkpoint:capture", checkpointId, filePath),
  checkpointList: (sessionId: string, workspacePath?: string) =>
    ipcRenderer.invoke("checkpoint:list", sessionId, workspacePath),
  checkpointGet: (checkpointId: string) => ipcRenderer.invoke("checkpoint:get", checkpointId),
  checkpointRestore: (checkpointId: string) =>
    ipcRenderer.invoke("checkpoint:restore", checkpointId),
  checkpointDelete: (checkpointId: string) => ipcRenderer.invoke("checkpoint:delete", checkpointId),

  execCommand: (
    command: string,
    cwd?: string,
    useWsl?: boolean,
    runId?: string,
    timeoutMs?: number,
  ) => ipcRenderer.invoke("fs:execCommand", command, cwd, useWsl, runId, timeoutMs),
  cancelRun: (runId: string) => ipcRenderer.invoke("fs:cancelRun", runId),
  grep: (pattern: string, path?: string) => ipcRenderer.invoke("fs:grep", pattern, path),
  glob: (pattern: string, basePath?: string) => ipcRenderer.invoke("fs:glob", pattern, basePath),
  topo: (basePath?: string, tracePath?: string) =>
    ipcRenderer.invoke("fs:topo", basePath, tracePath),
  getSkills: (workspacePath: string) => ipcRenderer.invoke("api:getSkills", workspacePath),
  getGraphEdges: (workspacePath: string) => ipcRenderer.invoke("graph:getEdges", workspacePath),

  watchDir: (dirPath: string) => ipcRenderer.invoke("fs:watchDir", dirPath),
  unwatchDir: (dirPath: string) => ipcRenderer.invoke("fs:unwatchDir", dirPath),

  createFile: (filePath: string) => ipcRenderer.invoke("fs:createFile", filePath),
  createDir: (dirPath: string) => ipcRenderer.invoke("fs:createDir", dirPath),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke("fs:rename", oldPath, newPath),
  deleteFile: (targetPath: string) => ipcRenderer.invoke("fs:delete", targetPath),
  exists: (targetPath: string) => ipcRenderer.invoke("fs:exists", targetPath),
  editFile: (filePath: string, oldContent: string, newContent: string) =>
    ipcRenderer.invoke("fs:editFile", filePath, oldContent, newContent),
  onFsChange: (callback: (dirPath: string, filename: string) => void) => {
    const h = (_event: Electron.IpcRendererEvent, dirPath: string, filename: string) =>
      callback(dirPath, filename);
    ipcRenderer.on("fs:change", h);
    return () => ipcRenderer.removeListener("fs:change", h);
  },

  indexingOpen: (workspacePath: string) => ipcRenderer.invoke("indexing:open", workspacePath),
  indexingClose: () => ipcRenderer.invoke("indexing:close"),
  indexingSearch: (workspacePath: string, query: string, topK?: number) =>
    ipcRenderer.invoke("indexing:search", workspacePath, query, topK),
  indexingReindex: (workspacePath: string, filePath?: string) =>
    ipcRenderer.invoke("indexing:reindex", workspacePath, filePath),
  indexingStatus: (workspacePath: string) => ipcRenderer.invoke("indexing:status", workspacePath),
  indexingArchitecture: (workspacePath: string) =>
    ipcRenderer.invoke("indexing:architecture", workspacePath),
  indexingImpact: (workspacePath: string, targetPath: string) =>
    ipcRenderer.invoke("indexing:impact", workspacePath, targetPath),
  indexingQueryGraph: (workspacePath: string, query: any) =>
    ipcRenderer.invoke("indexing:queryGraph", workspacePath, query),
  indexingExportGraphSnapshot: (workspacePath: string) =>
    ipcRenderer.invoke("indexing:exportGraphSnapshot", workspacePath),
  indexingImportGraphSnapshot: (workspacePath: string) =>
    ipcRenderer.invoke("indexing:importGraphSnapshot", workspacePath),
  rustSearch: (workspacePath: string, query: string, topK?: number) =>
    ipcRenderer.invoke("fs:rustSearch", workspacePath, query, topK),
  memorySet: (workspacePath: string, key: string, value: string) =>
    ipcRenderer.invoke("memory:set", workspacePath, key, value),
  memoryDelete: (workspacePath: string, key: string) =>
    ipcRenderer.invoke("memory:delete", workspacePath, key),
  memoryList: (workspacePath: string) => ipcRenderer.invoke("memory:list", workspacePath),
  ragList: (workspacePath: string) => ipcRenderer.invoke("rag:list", workspacePath),
  ragSave: (workspacePath: string, block: any) =>
    ipcRenderer.invoke("rag:save", workspacePath, block),
  ragDelete: (workspacePath: string, id: string) =>
    ipcRenderer.invoke("rag:delete", workspacePath, id),
  ragSearch: (workspacePath: string, query: string, topK?: number) =>
    ipcRenderer.invoke("rag:search", workspacePath, query, topK),
  swarmPort: () => ipcRenderer.invoke("swarm:port"),
  logStats: (stats: any) => ipcRenderer.invoke("system:logStats", stats),
  getUsageSummary: (workspacePath?: string | null, days?: number) =>
    ipcRenderer.invoke("system:getUsageSummary", workspacePath, days),
  getUsageOverview: () => ipcRenderer.invoke("system:getUsageOverview"),
  getDeviceName: () => ipcRenderer.invoke("system:getDeviceName"),
  readStudioConfig: (workspacePath: string) =>
    ipcRenderer.invoke("system:readStudioConfig", workspacePath),
  writeStudioConfig: (workspacePath: string, config: any) =>
    ipcRenderer.invoke("system:writeStudioConfig", workspacePath, config),
  designRead: (workspacePath: string) => ipcRenderer.invoke("system:designRead", workspacePath),
  designCreatePage: (workspacePath: string) =>
    ipcRenderer.invoke("system:designCreatePage", workspacePath),
  designCreateLayer: (workspacePath: string, pageId: string) =>
    ipcRenderer.invoke("system:designCreateLayer", workspacePath, pageId),
  designSelectPage: (workspacePath: string, pageId: string) =>
    ipcRenderer.invoke("system:designSelectPage", workspacePath, pageId),
  designPageAction: (workspacePath: string, pageId: string, action: string, name?: string) =>
    ipcRenderer.invoke("system:designPageAction", workspacePath, pageId, action, name),
  designLayerAction: (
    workspacePath: string,
    pageId: string,
    layerId: string,
    action: string,
    name?: string,
  ) => ipcRenderer.invoke("system:designLayerAction", workspacePath, pageId, layerId, action, name),
  designReorder: (
    workspacePath: string,
    kind: "page" | "layer",
    sourceId: string,
    targetId: string,
    pageId?: string,
    targetPageId?: string,
    reparent?: boolean,
  ) =>
    ipcRenderer.invoke(
      "system:designReorder",
      workspacePath,
      kind,
      sourceId,
      targetId,
      pageId,
      targetPageId,
      reparent,
    ),
  designCreateShape: (workspacePath: string, pageId: string, shape: any) =>
    ipcRenderer.invoke("system:designCreateShape", workspacePath, pageId, shape),
  designUpdateLayer: (workspacePath: string, pageId: string, layerId: string, patch: any) =>
    ipcRenderer.invoke("system:designUpdateLayer", workspacePath, pageId, layerId, patch),
  designRestorePage: (workspacePath: string, page: any, activePageId?: string) =>
    ipcRenderer.invoke("system:designRestorePage", workspacePath, page, activePageId),
  designImportFigma: (workspacePath: string, fileKey: string, token: string) =>
    ipcRenderer.invoke("system:designImportFigma", workspacePath, fileKey, token),
  designExportFiles: (workspacePath: string, pageId: string) =>
    ipcRenderer.invoke("system:designExportFiles", workspacePath, pageId),
  designExportPng: (workspacePath: string, pageId: string) =>
    ipcRenderer.invoke("system:designExportPng", workspacePath, pageId),
  designWritePng: (exportPath: string, base64data: string) =>
    ipcRenderer.invoke("system:designWritePng", exportPath, base64data),
  designReadTokens: (workspacePath: string) =>
    ipcRenderer.invoke("system:designReadTokens", workspacePath),
  designWriteTokens: (workspacePath: string, tokens: any) =>
    ipcRenderer.invoke("system:designWriteTokens", workspacePath, tokens),
  readTableCsv: (workspacePath: string, tableId: string) =>
    ipcRenderer.invoke("system:readTableCsv", workspacePath, tableId),
  writeTableCsv: (workspacePath: string, tableId: string, csvContent: string) =>
    ipcRenderer.invoke("system:writeTableCsv", workspacePath, tableId, csvContent),
  mcpListTools: (servers: any[]) => ipcRenderer.invoke("codeclub:mcp-list-tools", servers),
  mcpCallTool: (serverName: string, toolName: string, args: any) =>
    ipcRenderer.invoke("codeclub:mcp-call-tool", serverName, toolName, args),
  mcpPing: (serverConfig: any) => ipcRenderer.invoke("codeclub:mcp-ping", serverConfig),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  onUpdateAvailable: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on("update:available", h);
    return () => ipcRenderer.removeListener("update:available", h);
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on("update:not-available", h);
    return () => ipcRenderer.removeListener("update:not-available", h);
  },
  onUpdateDownloaded: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on("update:downloaded", h);
    return () => ipcRenderer.removeListener("update:downloaded", h);
  },
  onTerminalData: (id: string, callback: (data: string) => void) => {
    const h = (_event: Electron.IpcRendererEvent, dataId: string, data: string) => {
      if (dataId === id) callback(data);
    };
    ipcRenderer.on("terminal:data", h);
    return () => ipcRenderer.removeListener("terminal:data", h);
  },
  onDebugEvent: (workspacePath: string, callback: (event: any) => void) => {
    const h = (_event: Electron.IpcRendererEvent, path: string, data: any) => {
      if (path === workspacePath) callback(data);
    };
    ipcRenderer.on("debug:event", h);
    return () => ipcRenderer.removeListener("debug:event", h);
  },
};

contextBridge.exposeInMainWorld("api", api);
