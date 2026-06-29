import { ensureGraphCache } from "../ipc/fs/graphCache";
import { querySymbolEdges } from "./graphStore";
import { loadMeta } from "./workspaceIndex";

export interface ImpactResult {
  target: string;
  targetKind: "file" | "symbol";
  targetFile?: string;
  direct: string[];
  transitive: string[];
  callers: { name?: string; filePath: string; startLine: number; endLine: number }[];
}

function norm(value: string): string {
  return value.replace(/\\/g, "/");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

export async function analyzeImpact(
  workspacePath: string,
  targetPath: string,
): Promise<ImpactResult> {
  const meta = loadMeta(workspacePath);
  const targetSymbol = meta?.chunks.find((chunk) => chunk.name === targetPath);
  const targetFile = targetSymbol?.filePath ?? norm(targetPath);
  const graph = await ensureGraphCache(workspacePath);
  const target = norm(targetFile);
  const reverse = new Map<string, Set<string>>();

  for (const edge of graph.edges) {
    const source = norm(edge.source);
    const targetNode = norm(edge.target);
    const callers = reverse.get(targetNode) ?? new Set<string>();
    callers.add(source);
    reverse.set(targetNode, callers);
  }

  const direct = Array.from(reverse.get(target) ?? []).sort();
  const seen = new Set<string>([target]);
  const queue = [...direct];
  const transitive: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    transitive.push(current);
    for (const next of reverse.get(current) ?? []) {
      if (!seen.has(next)) queue.push(next);
    }
  }

  const exactCallerIds = targetSymbol
    ? new Set(querySymbolEdges(workspacePath, targetSymbol.name ?? "").map((edge) => edge.sourceId))
    : new Set<string>();
  const callers =
    targetSymbol && meta
      ? meta.chunks
          .filter((chunk) => chunk.id !== targetSymbol.id)
          .filter(
            (chunk) =>
              exactCallerIds.has(chunk.id) ||
              (exactCallerIds.size === 0 &&
                new RegExp(`\\b${targetSymbol.name}\\b`).test(chunk.code)),
          )
          .map((chunk) => ({
            name: chunk.name,
            filePath: chunk.filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
          }))
      : [];

  return {
    target: targetPath,
    targetKind: targetSymbol ? "symbol" : "file",
    targetFile,
    direct: uniqueSorted([...direct, ...callers.map((caller) => caller.filePath)]),
    transitive,
    callers,
  };
}
