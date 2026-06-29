import { ensureGraphCache } from "../ipc/fs/graphCache";
import {
  queryOutgoingSymbolEdges,
  queryRouteStore,
  querySymbolEdges,
  querySymbolStore,
} from "./graphStore";
import { loadMeta } from "./workspaceIndex";

export interface GraphQuery {
  pathPattern?: string;
  kind?: string;
  scope?: "files" | "symbols" | "routes";
  relation?: "callers" | "callees";
  namePattern?: string;
  minImports?: number;
  minImportedBy?: number;
  limit?: number;
}

export interface GraphQueryResult {
  id: string;
  path: string;
  kind: string;
  imports: number;
  importedBy: number;
  name?: string;
  startLine?: number;
  endLine?: number;
  relation?: string;
  line?: number;
}

function norm(value: string): string {
  return value.replace(/\\/g, "/");
}

function safeRegex(pattern?: string): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

export async function queryGraph(
  workspacePath: string,
  query: GraphQuery,
): Promise<GraphQueryResult[]> {
  if (query.scope === "routes") {
    const routes = queryRouteStore(workspacePath, {
      namePattern: query.namePattern ?? query.pathPattern,
      kind: query.kind,
      limit: query.limit,
    });
    return (routes ?? []).map((route) => ({
      id: `${route.kind}:${route.name}:${route.filePath}:${route.line}`,
      path: route.filePath,
      kind: route.kind,
      imports: 0,
      importedBy: 0,
      name: route.name,
      startLine: route.line,
      endLine: route.line,
      line: route.line,
    }));
  }

  if (query.scope === "symbols") {
    const meta = loadMeta(workspacePath);
    const chunks = meta?.chunks ?? [];
    const targetName = query.namePattern ?? query.pathPattern;
    if (query.relation && targetName) {
      const target = chunks.find((chunk) => chunk.name === targetName);
      const edges =
        query.relation === "callers"
          ? querySymbolEdges(workspacePath, targetName)
          : target
            ? queryOutgoingSymbolEdges(workspacePath, target.id)
            : [];
      const results: GraphQueryResult[] = [];
      for (const edge of edges) {
        const source = chunks.find((chunk) => chunk.id === edge.sourceId);
        const callee = chunks.find((chunk) => chunk.name === edge.targetName);
        const chunk = query.relation === "callers" ? source : callee;
        if (!chunk) continue;
        results.push({
          id: chunk.id,
          path: chunk.filePath,
          kind: chunk.kind ?? "symbol",
          imports: 0,
          importedBy: 0,
          name: chunk.name,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          relation: edge.kind,
        });
      }
      return results.slice(0, query.limit ?? 50);
    }

    const stored = querySymbolStore(workspacePath, {
      namePattern: query.namePattern ?? query.pathPattern,
      kind: query.kind,
      limit: query.limit,
    });
    const symbols =
      stored ??
      chunks
        .filter((chunk) => chunk.name)
        .filter((chunk) => !query.kind || chunk.kind === query.kind)
        .filter((chunk) => {
          const pattern = query.namePattern ?? query.pathPattern;
          return !pattern || chunk.name?.toLowerCase().includes(pattern.toLowerCase());
        })
        .slice(0, query.limit ?? 50)
        .map((chunk) => ({
          id: chunk.id,
          name: chunk.name!,
          kind: chunk.kind ?? "symbol",
          filePath: chunk.filePath,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
        }));

    return symbols.map((symbol) => ({
      id: symbol.id,
      path: symbol.filePath,
      kind: symbol.kind,
      imports: 0,
      importedBy: 0,
      name: symbol.name,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
    }));
  }

  const graph = await ensureGraphCache(workspacePath);
  const pathRegex = safeRegex(query.pathPattern);
  const imports = new Map<string, number>();
  const importedBy = new Map<string, number>();

  for (const edge of graph.edges) {
    const source = norm(edge.source);
    const target = norm(edge.target);
    imports.set(source, (imports.get(source) ?? 0) + 1);
    importedBy.set(target, (importedBy.get(target) ?? 0) + 1);
  }

  return graph.nodes
    .map((node) => {
      const path = norm(node.path || node.id);
      return {
        id: norm(node.id),
        path,
        kind: node.kind,
        imports: imports.get(path) ?? imports.get(norm(node.id)) ?? 0,
        importedBy: importedBy.get(path) ?? importedBy.get(norm(node.id)) ?? 0,
      };
    })
    .filter((node) => !query.kind || node.kind === query.kind)
    .filter((node) => !pathRegex || pathRegex.test(node.path))
    .filter((node) => node.imports >= (query.minImports ?? 0))
    .filter((node) => node.importedBy >= (query.minImportedBy ?? 0))
    .sort((a, b) => b.imports + b.importedBy - (a.imports + a.importedBy))
    .slice(0, query.limit ?? 50);
}
