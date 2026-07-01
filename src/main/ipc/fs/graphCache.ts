import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, dirname, extname, relative } from "path";
import { execFile } from "child_process";
import { app } from "electron";
import type { GraphData } from "../../../preload/types";
import type { TopographicNode } from "../../../shared/topographicNodes";
import { enrichTopographicNodes } from "../../../shared/topographicIdentity";
import { loadAstStore, loadGraphStore, saveAstStore, saveGraphStore } from "../../indexer/graphStore";
import { getScanBinaryPath } from "../../indexer/scanner";

function topoExePath(): string {
  const isDev = !app.isPackaged;
  if (isDev) return join(process.cwd(), "resources", "bin", "topo.exe");
  return join(process.resourcesPath, "resources", "bin", "topo.exe");
}

const graphStore = new Map<string, GraphData>();
const topographicStore = new Map<string, TopographicNode[]>();
const pendingPatches = new Map<string, ReturnType<typeof setTimeout>>();

function cacheDir(workspacePath: string): string {
  const dir = join(workspacePath, ".codeclub", "cache");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function graphPath(workspacePath: string): string {
  return join(cacheDir(workspacePath), "graph.json");
}

function topoPath(workspacePath: string): string {
  return join(cacheDir(workspacePath), "topographic.json");
}

function saveGraph(workspacePath: string, data: GraphData): void {
  saveGraphStore(workspacePath, data);
  try {
    writeFileSync(graphPath(workspacePath), JSON.stringify(data));
  } catch {}
}

function saveTopographic(workspacePath: string, data: TopographicNode[]): void {
  const enriched = enrichTopographicNodes(data);
  saveAstStore(workspacePath, enriched);
  try {
    writeFileSync(topoPath(workspacePath), JSON.stringify(enriched));
  } catch {}
}

function loadGraph(workspacePath: string): GraphData | null {
  const stored = loadGraphStore(workspacePath);
  if (stored) return stored;
  try {
    const p = graphPath(workspacePath);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function loadTopographic(workspacePath: string): TopographicNode[] | null {
  const stored = loadAstStore(workspacePath);
  if (stored) return stored;
  try {
    const p = topoPath(workspacePath);
    if (!existsSync(p)) return null;
    return enrichTopographicNodes(JSON.parse(readFileSync(p, "utf-8")));
  } catch {
    return null;
  }
}

function fullScanGraph(workspacePath: string): Promise<GraphData> {
  return new Promise((resolve) => {
    const binaryPath = topoExePath();
    if (!existsSync(binaryPath)) {
      resolve({ nodes: [], edges: [] });
      return;
    }
    execFile(
      binaryPath,
      [workspacePath, "--json"],
      { maxBuffer: 50 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          resolve({ nodes: [], edges: [] });
          return;
        }
        try {
          resolve(JSON.parse(stdout) as GraphData);
        } catch {
          resolve({ nodes: [], edges: [] });
        }
      },
    );
  });
}

function fullScanTopographic(workspacePath: string): Promise<TopographicNode[]> {
  return new Promise((resolve) => {
    const executable = getScanBinaryPath();
    if (!existsSync(executable)) {
      resolve([]);
      return;
    }
    execFile(
      executable,
      ["topographic", "tree", workspacePath],
      { maxBuffer: 50 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        try {
          resolve(enrichTopographicNodes(JSON.parse(stdout) as TopographicNode[]));
        } catch {
          resolve([]);
        }
      },
    );
  });
}

function scanSingleFileTopographic(filePath: string): Promise<TopographicNode[]> {
  return new Promise((resolve) => {
    const executable = getScanBinaryPath();
    if (!existsSync(executable)) {
      resolve([]);
      return;
    }
    execFile(
      executable,
      ["codeclub-nodes", filePath],
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve(Array.isArray(parsed) ? enrichTopographicNodes(parsed) : []);
        } catch {
          resolve([]);
        }
      },
    );
  });
}

function parseImports(content: string): string[] {
  const results: string[] = [];
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|[^;]+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /from\s+['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const p = m[1];
      if (p.startsWith("./") || p.startsWith("../")) {
        if (!results.includes(p)) results.push(p);
      }
    }
  }
  return results;
}

function resolveImport(filePath: string, importSpec: string): string | null {
  const dir = dirname(filePath);
  let resolved = join(dir, importSpec).replace(/\\/g, "/");

  const extensions = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".css",
    ".scss",
    ".json",
    ".c",
    ".h",
    ".cpp",
    ".hpp",
  ];
  for (const ext of extensions) {
    const c = resolved + ext;
    if (existsSync(c)) return c.replace(/\\/g, "/");
  }

  try {
    if (statSync(resolved).isDirectory()) {
      for (const idx of ["index.ts", "index.tsx", "index.js", "index.jsx"]) {
        const c = join(resolved, idx).replace(/\\/g, "/");
        if (existsSync(c)) return c;
      }
    }
  } catch {}

  return null;
}

function isIndexableExtension(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".rs",
    ".go",
    ".css",
    ".scss",
    ".json",
    ".html",
    ".md",
    ".yaml",
    ".yml",
    ".toml",
    ".c",
    ".h",
    ".cpp",
    ".hpp",
    ".txt",
  ].includes(ext);
}

export function getCachedGraph(workspacePath: string): GraphData | null {
  return graphStore.get(workspacePath) ?? null;
}

export function getCachedTopographic(workspacePath: string): TopographicNode[] | null {
  return topographicStore.get(workspacePath) ?? null;
}

export async function ensureGraphCache(workspacePath: string): Promise<GraphData> {
  let data: GraphData | null | undefined = graphStore.get(workspacePath);
  if (data) return data;

  data = loadGraph(workspacePath);
  if (data) {
    graphStore.set(workspacePath, data);
    return data;
  }

  data = await fullScanGraph(workspacePath);
  graphStore.set(workspacePath, data);
  saveGraph(workspacePath, data);
  return data;
}

export async function ensureTopographicCache(workspacePath: string): Promise<TopographicNode[]> {
  let data: TopographicNode[] | null | undefined = topographicStore.get(workspacePath);
  if (data) return data;

  data = loadTopographic(workspacePath);
  if (data) {
    topographicStore.set(workspacePath, data);
    return data;
  }

  data = await fullScanTopographic(workspacePath);
  topographicStore.set(workspacePath, data);
  saveTopographic(workspacePath, data);
  return data;
}

export async function initCache(workspacePath: string): Promise<void> {
  const diskGraph = loadGraph(workspacePath);
  const diskTopo = loadTopographic(workspacePath);

  if (diskGraph) graphStore.set(workspacePath, diskGraph);
  if (diskTopo) topographicStore.set(workspacePath, diskTopo);

  const [graph, topo] = await Promise.all([
    diskGraph ? Promise.resolve(null) : fullScanGraph(workspacePath),
    diskTopo ? Promise.resolve(null) : fullScanTopographic(workspacePath),
  ]);

  if (graph) {
    graphStore.set(workspacePath, graph);
    saveGraph(workspacePath, graph);
  }
  if (topo) {
    topographicStore.set(workspacePath, topo);
    saveTopographic(workspacePath, topo);
  }

  if (diskGraph || diskTopo) {
    fullScanGraph(workspacePath)
      .then((g) => {
        graphStore.set(workspacePath, g);
        saveGraph(workspacePath, g);
      })
      .catch(() => {});
    fullScanTopographic(workspacePath)
      .then((t) => {
        topographicStore.set(workspacePath, t);
        saveTopographic(workspacePath, t);
      })
      .catch(() => {});
  }
}

function patchGraphFile(workspacePath: string, filePath: string, exists: boolean): void {
  const graph = graphStore.get(workspacePath);
  if (!graph) return;

  const normPath = filePath.replace(/\\/g, "/");
  const ext = extname(filePath).toLowerCase().slice(1);
  const existingNode = graph.nodes.find(
    (n: any) => (n.path || "").replace(/\\/g, "/") === normPath,
  );
  const nodeId = existingNode?.id ?? normPath;

  if (!exists) {
    graph.nodes = graph.nodes.filter((n: any) => n.id !== nodeId);
    graph.edges = graph.edges.filter((e: any) => e.source !== nodeId && e.target !== nodeId);
  } else {
    try {
      const content = readFileSync(filePath, "utf-8");
      const importSpecs = parseImports(content);
      const resolvedTargets: string[] = [];
      for (const spec of importSpecs) {
        const target = resolveImport(filePath, spec);
        if (target) resolvedTargets.push(target);
      }

      graph.edges = graph.edges.filter((e: any) => e.source !== nodeId);
      for (const target of resolvedTargets) {
        graph.edges.push({ source: nodeId, target });
      }

      if (existingNode) {
        (existingNode as any).size = content.length;
        (existingNode as any).fileType = ext;
      } else {
        graph.nodes.push({
          id: nodeId,
          path: normPath,
          kind: "file",
          size: content.length,
          fileType: ext,
        } as any);
      }
    } catch {}
  }

  for (const n of graph.nodes) {
    (n as any).inDegree = graph.edges.filter((e: any) => e.target === n.id).length;
  }
  graphStore.set(workspacePath, graph);
  saveGraph(workspacePath, graph);
}

async function patchTopographicFile(
  workspacePath: string,
  filePath: string,
  exists: boolean,
): Promise<void> {
  const topo = topographicStore.get(workspacePath);
  if (!topo) return;

  const normPath = filePath.replace(/\\/g, "/");
  const filtered = topo.filter((n: any) => (n.path || "").replace(/\\/g, "/") !== normPath);

  if (exists && isIndexableExtension(filePath)) {
    try {
      const newNodes = await scanSingleFileTopographic(filePath);
      filtered.push(...newNodes);
    } catch {}
  }

  topographicStore.set(workspacePath, filtered);
  saveTopographic(workspacePath, filtered);
}

export function onFileChanged(workspacePath: string, filePath: string): void {
  if (!isIndexableExtension(filePath)) return;
  const relPath = relative(workspacePath, filePath);
  if (relPath.startsWith(".") || relPath.includes("node_modules")) return;

  const key = `${workspacePath}::${filePath}`;
  const existing = pendingPatches.get(key);
  if (existing) clearTimeout(existing);

  pendingPatches.set(
    key,
    setTimeout(() => {
      pendingPatches.delete(key);
      const fileExists = existsSync(filePath);
      patchGraphFile(workspacePath, filePath, fileExists);
      patchTopographicFile(workspacePath, filePath, fileExists);
    }, 300),
  );
}

export async function refreshCache(workspacePath: string): Promise<void> {
  const [graph, topo] = await Promise.all([
    fullScanGraph(workspacePath),
    fullScanTopographic(workspacePath),
  ]);
  graphStore.set(workspacePath, graph);
  topographicStore.set(workspacePath, topo);
  saveGraph(workspacePath, graph);
  saveTopographic(workspacePath, topo);
}

export function clearCache(workspacePath: string): void {
  graphStore.delete(workspacePath);
  topographicStore.delete(workspacePath);
}
