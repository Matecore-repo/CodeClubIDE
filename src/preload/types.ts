export interface GraphNode {
  id: string;
  path: string;
  kind: "file" | "dir" | "root";
  size: number;
  fileType: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface IndexChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  code: string;
  kind?: string;
  name?: string;
  imports?: string[];
}

export interface SearchResult {
  chunk: IndexChunk;
  score: number;
}

export interface IndexStatus {
  workspacePath: string;
  totalChunks: number;
  totalFiles: number;
  model: string;
  updatedAt: string | null;
  exists: boolean;
}

export interface FileRangeResult {
  data: string;
  hash: string;
  size: number;
  offset: number;
  length: number;
  encoding: "utf8" | "base64" | "zstd-base64";
  compressed: boolean;
  unchanged: boolean;
}

export interface FileDiffResult {
  data: string;
  hash: string;
  encoding: "utf8" | "base64" | "zstd-base64";
  compressed: boolean;
  unchanged: boolean;
  previousFound: boolean;
}

export interface StructuralNode {
  id: string;
  name: string;
  type: "function" | "class" | "interface" | "rule" | "element" | "section" | "block" | "other";
  ancestors: string[];
  startLine: number;
  endLine: number;
  content: string;
  baseHash: string;
}

import type {
  TopographicMutationRequest,
  TopographicMutationResult,
  TopographicNode,
  TopographicReadRequest,
} from "../shared/topographicNodes";

export interface DebugBreakpoint {
  filePath: string;
  line: number;
  condition?: string;
  verified?: boolean;
}
export interface DebugConfig {
  workspacePath: string;
  program: string;
  adapter?: "python" | "rust";
  adapterCommand?: string[];
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  breakpoints?: DebugBreakpoint[];
}

export interface RagBlock {
  id: string;
  name: string;
  code: string;
  language: string;
  filePath: string;
  startLine: number;
  endLine: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ElectronAPI {
  platform: NodeJS.Platform;
  storeGet: (name: string, key: string) => Promise<unknown>;
  storeSet: (name: string, key: string, value: unknown) => Promise<void>;
  openLink: (url: string) => Promise<void>;
  openEmail: (email: string) => Promise<void>;
  showNotification: (title: string, body: string) => Promise<void>;
  proxyFetch: (
    url: string,
    options?: any,
  ) => Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    data: string;
    headers: Record<string, string>;
    error?: string;
  }>;
  proxyFetchStream: (url: string, options?: any) => Promise<string>;
  onStreamData: (id: string, callback: (data: string) => void) => () => void;
  onStreamDone: (id: string, callback: () => void) => () => void;
  onStreamError: (id: string, callback: (err: string) => void) => () => void;
  getVersion: () => Promise<string>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  readStudioConfig: (workspacePath: string) => Promise<any>;
  writeStudioConfig: (workspacePath: string, config: any) => Promise<void>;
  designRead: (workspacePath: string) => Promise<any>;
  designCreatePage: (workspacePath: string) => Promise<any>;
  designCreateLayer: (workspacePath: string, pageId: string) => Promise<any>;
  designSelectPage: (workspacePath: string, pageId: string) => Promise<any>;
  designPageAction: (
    workspacePath: string,
    pageId: string,
    action: string,
    name?: string,
  ) => Promise<any>;
  designLayerAction: (
    workspacePath: string,
    pageId: string,
    layerId: string,
    action: string,
    name?: string,
  ) => Promise<any>;
  designReorder: (
    workspacePath: string,
    kind: "page" | "layer",
    sourceId: string,
    targetId: string,
    pageId?: string,
    targetPageId?: string,
    reparent?: boolean,
  ) => Promise<any>;
  designCreateShape: (workspacePath: string, pageId: string, shape: any) => Promise<any>;
  designUpdateLayer: (
    workspacePath: string,
    pageId: string,
    layerId: string,
    patch: any,
  ) => Promise<any>;
  designRestorePage: (workspacePath: string, page: any, activePageId?: string) => Promise<any>;
  designImportFigma: (workspacePath: string, fileKey: string, token: string) => Promise<any>;
  designExportFiles: (workspacePath: string, pageId: string) => Promise<any>;
  designExportPng: (workspacePath: string, pageId: string) => Promise<any>;
  designWritePng: (exportPath: string, base64data: string) => Promise<any>;
  designReadTokens: (workspacePath: string) => Promise<any>;
  designWriteTokens: (workspacePath: string, tokens: any) => Promise<any>;
  readTableCsv: (workspacePath: string, tableId: string) => Promise<string>;
  writeTableCsv: (workspacePath: string, tableId: string, csvContent: string) => Promise<void>;

  listDrives: () => Promise<string[]>;
  readDir: (dirPath: string) => Promise<{ name: string; path: string; isDirectory: boolean }[]>;
  readDirSync: (dirPath: string) => { name: string; path: string; isDirectory: boolean }[];
  recentFiles: (
    workspacePath: string,
    limit?: number,
  ) => Promise<{ path: string; name: string; modifiedAt: number }[]>;
  selectFolder: () => Promise<string | null>;
  selectFiles: () => Promise<string[]>;
  readFile: (filePath: string) => Promise<string | null>;
  readFileRange: (
    filePath: string,
    offset?: number,
    length?: number,
    knownHash?: string,
    plain?: boolean,
  ) => Promise<FileRangeResult | null>;
  fileDiff: (filePath: string, previousHash: string) => Promise<FileDiffResult | null>;
  readFileBase64: (filePath: string) => Promise<string | null>;
  readFileContent: (filePath: string) => string | null;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  listNodes: (filePath: string) => Promise<StructuralNode[] | { ok: false; reason: string }>;
  topographicTree: (workspacePath: string) => Promise<TopographicNode[]>;
  topographicDiffAsync: (
    workspacePath: string,
    oldTree: any[],
    newTree: any[],
  ) => Promise<import("../shared/topographicNodes").TopographicDiffResult[]>;
  topographicRead: (
    request: TopographicReadRequest,
  ) => Promise<{ content: string; hash: string; startLine: number; endLine: number }>;
  topographicMutate: (request: TopographicMutationRequest) => Promise<TopographicMutationResult>;
  appendNode: (filePath: string, content: string) => Promise<{ ok: boolean; reason?: string }>;
  replaceNodeRange: (
    filePath: string,
    startLine: number,
    endLine: number,
    content: string,
  ) => Promise<{ ok: boolean; reason?: string }>;
  copyFile: (src: string, dest: string) => Promise<boolean>;
  gitFileOriginal: (
    workspacePath: string,
    filePath: string,
  ) => Promise<{
    ok: boolean;
    content: string;
    status: "tracked" | "untracked" | "outside-workspace" | "unavailable";
  }>;

  createTerminal: (cwd: string, useWsl?: boolean) => Promise<string>;
  writeToTerminal: (id: string, data: string) => Promise<void>;
  killTerminal: (id: string) => Promise<void>;
  resizeTerminal: (id: string, cols: number, rows: number) => Promise<void>;
  attachTerminal: (id: string) => Promise<string>;
  onTerminalData: (id: string, callback: (data: string) => void) => () => void;
  debugStart: (config: DebugConfig) => Promise<{ ok: boolean; adapter?: string; error?: string }>;
  debugRequest: (
    workspacePath: string,
    command: string,
    args?: Record<string, unknown>,
  ) => Promise<any>;
  debugStop: (workspacePath: string) => Promise<void>;
  debugState: (workspacePath: string) => Promise<Record<string, unknown>>;
  onDebugEvent: (workspacePath: string, callback: (event: any) => void) => () => void;
  checkpointCreate: (
    sessionId: string,
    workspacePath: string,
    label: string,
    messages: unknown[],
  ) => Promise<string>;
  checkpointCapture: (
    checkpointId: string,
    filePath: string,
  ) => Promise<{ captured: boolean; reason?: string }>;
  checkpointList: (sessionId: string, workspacePath?: string) => Promise<any[]>;
  checkpointGet: (checkpointId: string) => Promise<any>;
  checkpointRestore: (checkpointId: string) => Promise<{ messages: unknown[]; errors: string[] }>;
  checkpointDelete: (checkpointId: string) => Promise<void>;

  execCommand: (
    command: string,
    cwd?: string,
    useWsl?: boolean,
    runId?: string,
    timeoutMs?: number,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  cancelRun: (runId: string) => Promise<void>;
  grep: (pattern: string, path?: string) => Promise<string[]>;
  glob: (pattern: string, basePath?: string) => Promise<string[]>;
  topo: (basePath?: string, tracePath?: string) => Promise<string>;
  getGraphEdges: (workspacePath: string) => Promise<GraphData>;

  watchDir: (dirPath: string) => Promise<void>;
  unwatchDir: (dirPath: string) => Promise<void>;
  onFsChange: (callback: (dirPath: string, filename: string) => void) => () => void;

  createFile: (filePath: string) => Promise<boolean>;
  createDir: (dirPath: string) => Promise<boolean>;
  rename: (oldPath: string, newPath: string) => Promise<boolean>;
  deleteFile: (targetPath: string) => Promise<boolean>;
  exists: (targetPath: string) => Promise<boolean>;
  editFile: (
    filePath: string,
    oldContent: string,
    newContent: string,
  ) => Promise<{ ok: boolean; error?: string }>;

  indexingOpen: (workspacePath: string) => Promise<void>;
  indexingClose: () => Promise<void>;
  indexingSearch: (workspacePath: string, query: string, topK?: number) => Promise<SearchResult[]>;
  indexingReindex: (workspacePath: string, filePath?: string) => Promise<void>;
  indexingStatus: (workspacePath: string) => Promise<IndexStatus>;
  rustSearch: (workspacePath: string, query: string, topK?: number) => Promise<SearchResult[]>;
  memorySet: (workspacePath: string, key: string, value: string) => Promise<boolean>;
  memoryDelete: (workspacePath: string, key: string) => Promise<boolean>;
  memoryList: (workspacePath: string) => Promise<{ key: string; value: string; ts: string }[]>;
  ragList: (workspacePath: string) => Promise<RagBlock[]>;
  ragSave: (workspacePath: string, block: RagBlock) => Promise<RagBlock>;
  ragDelete: (workspacePath: string, id: string) => Promise<boolean>;
  ragSearch: (
    workspacePath: string,
    query: string,
    topK?: number,
  ) => Promise<{ block: RagBlock; score: number }[]>;
  getSkills: (
    workspacePath: string,
  ) => Promise<{ name: string; description: string; content: string }[]>;
  swarmPort: () => Promise<number | null>;
  logStats: (stats: Record<string, unknown>) => Promise<void>;
  getUsageSummary: (
    workspacePath?: string | null,
    days?: number,
  ) => Promise<{ day: string; opens: number; messages: number }[]>;
  getUsageOverview: () => Promise<{
    usage: { day: string; opens: number; messages: number }[];
    totalMessages: number;
    recentWorkspaces: { workspacePath: string; lastOpenedAt: string }[];
  }>;
  getDeviceName: () => Promise<string>;
  checkForUpdates: () => Promise<void>;
  onUpdateAvailable: (callback: () => void) => () => void;
  onUpdateNotAvailable: (callback: () => void) => () => void;
  onUpdateDownloaded: (callback: () => void) => () => void;
}
