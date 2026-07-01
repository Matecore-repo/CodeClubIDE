import { registerTool } from "../registry";
import { workspaceFilePath } from "../workspacePath";
import { diffTopographicNodeTrees, hasComparableAstNodes } from "../../../../../../shared/topographicDiff";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/$/, "");
}

function scopedTree(tree: any[], workspacePath: string, targetPath: string): any[] {
  const target = normalizePath(targetPath);
  return tree.filter((node) => {
    const nodePath = normalizePath(node.path);
    const nodeAbs = normalizePath(workspaceFilePath(workspacePath, nodePath));
    return (
      nodePath === target ||
      nodePath.startsWith(`${target}/`) ||
      nodeAbs === target ||
      nodeAbs.startsWith(`${target}/`)
    );
  });
}

function keywordsFromText(...parts: string[]): string[] {
  const ignored = new Set(["return", "include", "define", "class", "void", "const", "auto"]);
  const keywords = new Set<string>();
  for (const part of parts) {
    for (const token of part.split(/[^A-Za-z0-9_]+|(?=[A-Z])/)) {
      const normalized = token.trim();
      if (normalized.length < 3 || ignored.has(normalized.toLowerCase())) continue;
      keywords.add(normalized);
      if (keywords.size >= 10) return Array.from(keywords);
    }
  }
  return Array.from(keywords);
}

function comparisonContext(a: string, b: string): Record<string, unknown> {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const first = firstDifference(aLines, bLines);
  const before = first > 0 ? aLines[first - 1]?.trim().slice(0, 240) ?? "" : "";
  const after = first > 0 ? bLines[first - 1]?.trim().slice(0, 240) ?? "" : "";
  return {
    changed: a !== b,
    linesA: aLines.length,
    linesB: bLines.length,
    firstDifferenceLine: first,
    before,
    after,
    keywords: keywordsFromText(before, after),
  };
}

registerTool({
  definition: {
    type: "function",
    function: {
      name: "diff_topographic",
      description: "Compare AST structural differences between two files or directories.",
      parameters: {
        type: "object",
        properties: {
          filePathA: {
            type: "string",
            description: "The original file or folder path. If empty, uses the entire workspace.",
          },
          filePathB: {
            type: "string",
            description: "The modified file or folder path to compare against filePathA.",
          },
        },
        required: [],
      },
    },
  },
  execute: async (args: { filePathA?: string; filePathB?: string }, workspacePath) => {
    if (!workspacePath) return "Error: diff_topographic requires an active workspace.";
    try {
      const targetA = args.filePathA ? workspaceFilePath(workspacePath, args.filePathA) : workspacePath;
      const targetB = args.filePathB ? workspaceFilePath(workspacePath, args.filePathB) : workspacePath;
      const workspaceTree = await window.api.topographicTree(workspacePath);
      const aTree = scopedTree(workspaceTree, workspacePath, targetA);
      const bTree = scopedTree(workspaceTree, workspacePath, targetB);
      if (hasComparableAstNodes(aTree) || hasComparableAstNodes(bTree)) {
        const results = diffTopographicNodeTrees(aTree, bTree);
        const textContext =
          args.filePathA && args.filePathB
            ? await textComparison(workspacePath, args)
            : undefined;
        return JSON.stringify({
          mode: "ast",
          freshness: "fresh",
          warnings: [],
          keywords: collectKeywords(results, textContext),
          textContext,
          results,
          total: results.length,
          truncated: false,
        });
      }
      if (args.filePathA && args.filePathB) return JSON.stringify(await textFallback(workspacePath, args));

      const diffs = await window.api.topographicDiffAsync(workspacePath, aTree, bTree);
      return JSON.stringify({
        mode: "degraded",
        freshness: "fresh",
        warnings: ["no-comparable-ast-nodes"],
        keywords: collectKeywords(diffs),
        results: diffs,
        total: diffs.length,
        truncated: false,
      });
    } catch (err) {
      if (args.filePathA && args.filePathB) {
        return JSON.stringify(await textFallback(workspacePath, args, [(err as Error).message]));
      }
      return `Error in diff_topographic: ${(err as Error).message}`;
    }
  },
});

function collectKeywords(results: any[], textContext?: any): string[] {
  const keywords = new Set<string>();
  for (const item of results) {
    for (const keyword of item.keywords ?? []) {
      keywords.add(keyword);
      if (keywords.size >= 12) return Array.from(keywords);
    }
  }
  for (const keyword of textContext?.keywords ?? []) {
    keywords.add(keyword);
    if (keywords.size >= 12) return Array.from(keywords);
  }
  return Array.from(keywords);
}

async function textComparison(
  workspacePath: string,
  args: { filePathA?: string; filePathB?: string },
): Promise<Record<string, unknown> | undefined> {
  const [a, b] = await Promise.all([
    window.api.readFile(workspaceFilePath(workspacePath, args.filePathA!)),
    window.api.readFile(workspaceFilePath(workspacePath, args.filePathB!)),
  ]);
  if (a === null || b === null) return undefined;
  return comparisonContext(a, b);
}

async function textFallback(
  workspacePath: string,
  args: { filePathA?: string; filePathB?: string },
  warnings: string[] = ["no-comparable-ast-nodes"],
): Promise<unknown> {
  const [a, b] = await Promise.all([
    window.api.readFile(workspaceFilePath(workspacePath, args.filePathA!)),
    window.api.readFile(workspaceFilePath(workspacePath, args.filePathB!)),
  ]);
  if (a === null || b === null) {
    return {
      mode: "degraded",
      freshness: "fresh",
      warnings: [...warnings, "file-not-readable"],
      results: [],
      total: 0,
      truncated: false,
    };
  }
  const context = comparisonContext(a, b);
  const results = [
    {
      kind: "text-fallback",
      ...context,
    },
  ];
  return {
    mode: "text-fallback",
    freshness: "fresh",
    warnings,
    keywords: context.keywords,
    textContext: context,
    results,
    total: results.length,
    truncated: false,
  };
}

function firstDifference(a: string[], b: string[]): number {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) if (a[index] !== b[index]) return index + 1;
  return 0;
}
