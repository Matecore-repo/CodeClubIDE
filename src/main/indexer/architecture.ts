import { extname } from "path";
import type { GraphData } from "../../preload/types";
import { ensureGraphCache, ensureTopographicCache } from "../ipc/fs/graphCache";
import { getGraphStoreStats, graphDbPath, queryRouteStore } from "./graphStore";
import { loadMeta } from "./workspaceIndex";

export interface ArchitectureHotspot {
  path: string;
  imports: number;
  importedBy: number;
  astNodes: number;
  routes: number;
  score: number;
  keywords: string[];
}

export interface ArchitectureSummary {
  workspacePath: string;
  graphDbPath: string;
  totalFiles: number;
  totalChunks: number;
  totalEdges: number;
  sources: {
    graphFiles: number;
    graphEdges: number;
    metaChunks: number;
    astFiles: number;
    astNodes: number;
    symbols: number;
    symbolEdges: number;
    routes: number;
  };
  quality: { level: "full" | "partial" | "degraded"; reasons: string[] };
  schema: {
    astNodeTypes: { type: string; count: number }[];
    edgeTypes: { type: string; count: number }[];
  };
  languages: { language: string; files: number; chunks: number }[];
  topDirectories: { path: string; files: number }[];
  hotspots: ArchitectureHotspot[];
  entryPoints: string[];
  routes: { kind: string; name: string; filePath: string; line: number }[];
}

const EXT_LANG: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TSX",
  ".js": "JavaScript",
  ".jsx": "JSX",
  ".css": "CSS",
  ".scss": "SCSS",
  ".json": "JSON",
  ".md": "Markdown",
  ".py": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".html": "HTML",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".c": "C",
  ".h": "C/C++ Header",
  ".cpp": "C++",
  ".hpp": "C++ Header",
  ".sh": "Shell",
  ".bash": "Shell",
};

function languageFor(path: string): string {
  return EXT_LANG[extname(path).toLowerCase()] ?? "Other";
}

function topDirectory(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.length > 1 ? parts[0] : ".";
}

function filePathsFromGraph(graph: GraphData): string[] {
  return graph.nodes
    .filter((node) => node.kind === "file")
    .map((node) => (node.path || node.id).replace(/\\/g, "/"));
}

function relativeWorkspacePath(workspacePath: string, path: string): string {
  const normalizedWorkspace = workspacePath.replace(/\\/g, "/").replace(/\/$/, "");
  const normalizedPath = path.replace(/\\/g, "/");
  return normalizedPath.startsWith(`${normalizedWorkspace}/`)
    ? normalizedPath.slice(normalizedWorkspace.length + 1)
    : normalizedPath;
}

function edgeId(value: string): string {
  return value.replace(/\\/g, "/");
}

function findEntryPoints(paths: string[]): string[] {
  const patterns = [
    /(^|\/)(main|index|app|server|preload)\.(ts|tsx|js|jsx|c|cpp|rs|go|py)$/i,
    /(^|\/)package\.json$/i,
    /(^|\/)electron-builder\.config\.ts$/i,
  ];
  return paths.filter((path) => patterns.some((pattern) => pattern.test(path))).slice(0, 20);
}

function detectRoutes(
  chunks: { code: string; filePath: string; startLine: number }[],
): { kind: string; name: string; filePath: string; line: number }[] {
  const patterns = [
    { kind: "electron-ipc", regex: /ipcMain\.handle\(\s*["'`]([^"'`]+)["'`]/g },
    { kind: "electron-ipc", regex: /ipcMain\.on\(\s*["'`]([^"'`]+)["'`]/g },
    { kind: "http-route", regex: /\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g },
  ];
  const routes: { kind: string; name: string; filePath: string; line: number }[] = [];
  for (const chunk of chunks) {
    const lines = chunk.code.split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.regex.exec(lines[lineIndex])) !== null) {
          routes.push({
            kind: pattern.kind,
            name:
              pattern.kind === "http-route" ? `${match[1].toUpperCase()} ${match[2]}` : match[1],
            filePath: chunk.filePath,
            line: chunk.startLine + lineIndex,
          });
        }
      }
    }
  }
  return routes.slice(0, 100);
}

function isHotspotEligible(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  if (/(^|\/)(node_modules|dist|build|out|coverage|\.git)(\/|$)/.test(lower)) return false;
  if (/(^|\/)(log|logs|tmp|temp)(\/|$)/.test(lower)) return false;
  if (/(^|\/)(hello|log)\.txt$/.test(lower)) return false;
  if (/(^|\/)_.*test.*\.(txt|html)$/.test(lower)) return false;
  if (/\.(log|tmp|cache)$/i.test(lower)) return false;
  return true;
}

function architectureQuality(args: {
  files: number;
  graphEdges: number;
  astNodes: number;
  symbolEdges: number;
}): { level: "full" | "partial" | "degraded"; reasons: string[] } {
  const reasons: string[] = [];
  if (args.files === 0) reasons.push("no-files-indexed");
  if (args.astNodes === 0) reasons.push("no-ast-nodes");
  if (args.graphEdges === 0) reasons.push("no-file-edges");
  if (args.symbolEdges === 0) reasons.push("no-symbol-edges");

  if (args.files === 0 || args.astNodes === 0) return { level: "degraded", reasons };
  if (args.graphEdges === 0 || args.symbolEdges === 0) return { level: "partial", reasons };
  return { level: "full", reasons };
}

function hotspotKeywords(path: string, routeCount: number): string[] {
  const keywords = new Set<string>();
  for (const token of path.split(/[^A-Za-z0-9_]+|(?=[A-Z])/)) {
    const normalized = token.trim();
    if (normalized.length < 3) continue;
    keywords.add(normalized);
    if (keywords.size >= 8) break;
  }
  if (routeCount > 0) keywords.add("route");
  return Array.from(keywords);
}

export async function getArchitectureSummary(workspacePath: string): Promise<ArchitectureSummary> {
  const meta = loadMeta(workspacePath);
  const storeStats = getGraphStoreStats(workspacePath);
  const [graph, astNodes] = await Promise.all([
    ensureGraphCache(workspacePath),
    ensureTopographicCache(workspacePath),
  ]);
  const graphFiles = filePathsFromGraph(graph).map((path) => relativeWorkspacePath(workspacePath, path));
  const chunkFiles = meta
    ? Array.from(
        new Set(
          meta.chunks.map((chunk) => relativeWorkspacePath(workspacePath, chunk.filePath)),
        ),
      )
    : [];
  const astFiles = astNodes
    .filter((node) => node.type === "file")
    .map((node) => relativeWorkspacePath(workspacePath, node.path));
  const files = Array.from(new Set([...graphFiles, ...chunkFiles, ...astFiles]));

  const chunksByFile = new Map<string, number>();
  for (const chunk of meta?.chunks ?? []) {
    const path = relativeWorkspacePath(workspacePath, chunk.filePath);
    chunksByFile.set(path, (chunksByFile.get(path) ?? 0) + 1);
  }

  const languageStats = new Map<string, { files: Set<string>; chunks: number }>();
  const dirStats = new Map<string, number>();
  for (const file of files) {
    const language = languageFor(file);
    const stats = languageStats.get(language) ?? { files: new Set<string>(), chunks: 0 };
    stats.files.add(file);
    stats.chunks += chunksByFile.get(file) ?? 0;
    languageStats.set(language, stats);
    const dir = topDirectory(file);
    dirStats.set(dir, (dirStats.get(dir) ?? 0) + 1);
  }

  const imports = new Map<string, number>();
  const importedBy = new Map<string, number>();
  for (const edge of graph.edges) {
    const source = relativeWorkspacePath(workspacePath, edgeId(edge.source));
    const target = relativeWorkspacePath(workspacePath, edgeId(edge.target));
    imports.set(source, (imports.get(source) ?? 0) + 1);
    importedBy.set(target, (importedBy.get(target) ?? 0) + 1);
  }

  const astNodesByFile = new Map<string, number>();
  const astNodeTypes = new Map<string, number>();
  for (const node of astNodes) {
    astNodeTypes.set(node.type, (astNodeTypes.get(node.type) ?? 0) + 1);
    if (!node.isCode || node.type === "file") continue;
    const path = relativeWorkspacePath(workspacePath, node.path);
    astNodesByFile.set(path, (astNodesByFile.get(path) ?? 0) + 1);
  }

  const routes = queryRouteStore(workspacePath, { limit: 100 }) ?? detectRoutes(meta?.chunks ?? []);
  const routesByFile = new Map<string, number>();
  for (const route of routes) {
    const path = relativeWorkspacePath(workspacePath, route.filePath);
    routesByFile.set(path, (routesByFile.get(path) ?? 0) + 1);
  }

  const hotspots = files
    .map((path) => {
      const item = {
        path,
        imports: imports.get(path) ?? 0,
        importedBy: importedBy.get(path) ?? 0,
        astNodes: astNodesByFile.get(path) ?? 0,
        routes: routesByFile.get(path) ?? 0,
        score: 0,
        keywords: [] as string[],
      };
      item.score = item.imports + item.importedBy * 2 + item.routes * 3 + Math.min(item.astNodes, 10);
      item.keywords = hotspotKeywords(path, item.routes);
      return item;
    })
    .filter((item) => item.score > 0 && isHotspotEligible(item.path))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  return {
    workspacePath,
    graphDbPath: graphDbPath(workspacePath),
    totalFiles: files.length,
    totalChunks: meta?.chunks.length ?? 0,
    totalEdges: graph.edges.length,
    sources: {
      graphFiles: graphFiles.length,
      graphEdges: graph.edges.length,
      metaChunks: meta?.chunks.length ?? 0,
      astFiles: astFiles.length,
      astNodes: astNodes.length,
      symbols: storeStats.symbols,
      symbolEdges: storeStats.symbolEdges,
      routes: routes.length,
    },
    quality: architectureQuality({
      files: files.length,
      graphEdges: graph.edges.length,
      astNodes: astNodes.length,
      symbolEdges: storeStats.symbolEdges,
    }),
    schema: {
      astNodeTypes: Array.from(astNodeTypes.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      edgeTypes: [
        { type: "IMPORTS", count: graph.edges.length },
        { type: "CALLS", count: storeStats.symbolEdges },
        { type: "CONTAINS", count: storeStats.astEdges },
        { type: "ROUTES", count: routes.length },
      ].filter((edge) => edge.count > 0),
    },
    languages: Array.from(languageStats.entries())
      .map(([language, stats]) => ({ language, files: stats.files.size, chunks: stats.chunks }))
      .sort((a, b) => b.files - a.files),
    topDirectories: Array.from(dirStats.entries())
      .map(([path, count]) => ({ path, files: count }))
      .sort((a, b) => b.files - a.files)
      .slice(0, 15),
    hotspots,
    entryPoints: findEntryPoints(files),
    routes,
  };
}
