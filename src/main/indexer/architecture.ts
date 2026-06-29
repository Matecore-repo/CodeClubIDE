import { extname } from "path";
import type { GraphData } from "../../preload/types";
import { ensureGraphCache } from "../ipc/fs/graphCache";
import { graphDbPath, queryRouteStore } from "./graphStore";
import { loadMeta } from "./workspaceIndex";

export interface ArchitectureHotspot {
  path: string;
  imports: number;
  importedBy: number;
}

export interface ArchitectureSummary {
  workspacePath: string;
  graphDbPath: string;
  totalFiles: number;
  totalChunks: number;
  totalEdges: number;
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
  ".cpp": "C++",
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

export async function getArchitectureSummary(workspacePath: string): Promise<ArchitectureSummary> {
  const meta = loadMeta(workspacePath);
  const graph = await ensureGraphCache(workspacePath);
  const graphFiles = filePathsFromGraph(graph);
  const chunkFiles = meta ? Array.from(new Set(meta.chunks.map((chunk) => chunk.filePath))) : [];
  const files = graphFiles.length > 0 ? graphFiles : chunkFiles;

  const chunksByFile = new Map<string, number>();
  for (const chunk of meta?.chunks ?? []) {
    chunksByFile.set(chunk.filePath, (chunksByFile.get(chunk.filePath) ?? 0) + 1);
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
    const source = edgeId(edge.source);
    const target = edgeId(edge.target);
    imports.set(source, (imports.get(source) ?? 0) + 1);
    importedBy.set(target, (importedBy.get(target) ?? 0) + 1);
  }

  const hotspots = files
    .map((path) => ({
      path,
      imports: imports.get(path) ?? 0,
      importedBy: importedBy.get(path) ?? 0,
    }))
    .filter((item) => item.imports > 0 || item.importedBy > 0)
    .sort((a, b) => b.imports + b.importedBy - (a.imports + a.importedBy))
    .slice(0, 15);

  return {
    workspacePath,
    graphDbPath: graphDbPath(workspacePath),
    totalFiles: files.length,
    totalChunks: meta?.chunks.length ?? 0,
    totalEdges: graph.edges.length,
    languages: Array.from(languageStats.entries())
      .map(([language, stats]) => ({ language, files: stats.files.size, chunks: stats.chunks }))
      .sort((a, b) => b.files - a.files),
    topDirectories: Array.from(dirStats.entries())
      .map(([path, count]) => ({ path, files: count }))
      .sort((a, b) => b.files - a.files)
      .slice(0, 15),
    hotspots,
    entryPoints: findEntryPoints(files),
    routes: queryRouteStore(workspacePath, { limit: 100 }) ?? detectRoutes(meta?.chunks ?? []),
  };
}
