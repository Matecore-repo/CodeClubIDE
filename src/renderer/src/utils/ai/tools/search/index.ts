import { registerTool } from "../registry";
import { workspaceFilePath } from "../workspacePath";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type SearchNode = {
  id: string;
  name: string;
  type: string;
  path: string;
  language: string;
  startLine: number;
  endLine: number;
  isCode: boolean;
  [key: string]: unknown;
};

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function inPathScope(workspacePath: string, scopePath: string, node: SearchNode): boolean {
  const scope = normalizePath(scopePath).replace(/\/$/, "");
  const nodePath = normalizePath(node.path);
  const nodeAbs = normalizePath(workspaceFilePath(workspacePath, nodePath));
  return nodePath === scope || nodePath.startsWith(`${scope}/`) || nodeAbs === scope || nodeAbs.startsWith(`${scope}/`);
}

function wildcardRegex(query: string): RegExp {
  return new RegExp(query.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"), "i");
}

function parseGrepLines(lines: string[]): Record<string, number[]> {
  const linesByFile: Record<string, number[]> = {};
  for (const line of lines) {
    const match = line.match(/^(.+?):(\d+):/);
    if (!match) continue;
    const file = normalizePath(match[1]);
    const lineNumber = parseInt(match[2], 10);
    if (!linesByFile[file]) linesByFile[file] = [];
    linesByFile[file].push(lineNumber);
  }
  return linesByFile;
}

function metadataMatches(
  node: SearchNode,
  args: { query?: string; nodeType?: string; language?: string },
): boolean {
  if (args.query && !wildcardRegex(args.query).test(node.name)) return false;
  if (args.nodeType && node.type !== args.nodeType) return false;
  if (args.language && node.language.toLowerCase() !== args.language.toLowerCase()) return false;
  return true;
}

function lineMatchesForNode(
  workspacePath: string,
  node: SearchNode,
  linesByFile: Record<string, number[]>,
): number[] {
  const normalizedNodePath = normalizePath(node.path);
  const normalizedAbsPath = normalizePath(workspaceFilePath(workspacePath, normalizedNodePath));
  const nodeName = normalizedNodePath.split("/").pop();
  const matches = new Set<number>();
  for (const [file, lines] of Object.entries(linesByFile)) {
    const normalizedFile = normalizePath(file);
    const samePath =
      normalizedFile === normalizedNodePath ||
      normalizedFile === normalizedAbsPath ||
      normalizedNodePath.endsWith(`/${normalizedFile}`) ||
      normalizedAbsPath.endsWith(`/${normalizedFile}`) ||
      normalizedFile.endsWith(`/${normalizedNodePath}`) ||
      (nodeName != null && normalizedFile === nodeName);
    if (samePath) lines.forEach((line) => matches.add(line));
  }
  return Array.from(matches);
}

function smallestContainingNodes(
  workspacePath: string,
  tree: SearchNode[],
  linesByFile: Record<string, number[]>,
  args: { nodeType?: string; language?: string },
): SearchNode[] {
  const byId = new Map<string, SearchNode>();
  for (const node of tree) {
    if (args.nodeType && node.type !== args.nodeType) continue;
    if (args.language && node.language.toLowerCase() !== args.language.toLowerCase()) continue;
    const lines = lineMatchesForNode(workspacePath, node, linesByFile);
    if (lines.length === 0) continue;
    if (node.type === "workspace" || node.type === "folder") continue;
    const containsLine =
      node.type === "file" || lines.some((line) => line >= node.startLine && line <= node.endLine);
    if (!containsLine) continue;
    byId.set(node.id, node);
  }

  const candidates = Array.from(byId.values()).sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.startLine - b.startLine ||
      a.endLine - a.startLine - (b.endLine - b.startLine),
  );
  const selected = new Map<string, SearchNode>();
  for (const node of candidates) {
    const lines = lineMatchesForNode(workspacePath, node, linesByFile);
    for (const line of lines) {
      const currentKey = `${normalizePath(node.path)}:${line}`;
      const current = selected.get(currentKey);
      if (!current || node.endLine - node.startLine < current.endLine - current.startLine) {
        selected.set(currentKey, node);
      }
    }
  }
  return Array.from(new Map(Array.from(selected.values()).map((node) => [node.id, node])).values());
}

registerTool({
  definition: {
    type: "function",
    function: {
      name: "search",
      description: "Search file text with classic grep or AST node metadata.",
      parameters: {
        type: "object",
        properties: {
          subtool: { type: "string", enum: ["classic-rust", "rust"] },
          query: {
            type: "string",
            description:
              "Text/regex for classic-rust; case-insensitive name/metadata (supports *) for rust",
          },
          path: {
            type: "string",
            description: "Optional classic-rust search path or rust path prefix",
          },
          nodeType: { type: "string", description: "Optional AST node type" },
          language: { type: "string", description: "Optional AST language" },
          contentPattern: {
            type: "string",
            description: "Regex to filter AST nodes by their actual textual content",
          },
          limit: { type: "number", description: "Maximum results; defaults to 50 and caps at 200" },
        },
        required: ["subtool"],
      },
    },
  },
  execute: async (
    args: {
      subtool: "classic-rust" | "rust";
      query?: string;
      path?: string;
      nodeType?: string;
      language?: string;
      contentPattern?: string;
      limit?: number;
    },
    workspacePath,
  ) => {
    if (!workspacePath) return `Error: search/${args.subtool} requires an active workspace.`;
    const limit = Math.max(1, Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
    const searchPath = workspaceFilePath(
      workspacePath,
      !args.path || args.path === "." ? workspacePath : args.path,
    );
    try {
      if (args.subtool === "classic-rust") {
        if (!args.query) return "Error: search/classic-rust requires query.";
        const results = await window.api.grep(args.query, searchPath);
        return JSON.stringify({
          results: results.slice(0, limit),
          total: results.length,
          truncated: results.length > limit,
        });
      }

      const tree = ((await window.api.topographicTree(workspacePath)) as unknown as SearchNode[]).filter(
        (node) => inPathScope(workspacePath, searchPath, node),
      );
      const warnings: string[] = [];
      const availableNodeTypes = Array.from(new Set(tree.map((node) => node.type))).sort();
      if (args.nodeType && !availableNodeTypes.includes(args.nodeType)) {
        return JSON.stringify({
          mode: "ast",
          freshness: "fresh",
          warnings: ["invalid-node-type"],
          availableNodeTypes,
          results: [],
          total: 0,
          truncated: false,
        });
      }

      if (args.contentPattern) {
        const grepRes = await window.api.grep(args.contentPattern, searchPath);
        const containing = smallestContainingNodes(
          workspacePath,
          tree.filter((node) => metadataMatches(node, args)),
          parseGrepLines(grepRes),
          args,
        ).map((node) => ({ ...node, matchKind: "content" }));
        return JSON.stringify({
          mode: containing.length > 0 ? "ast" : "text-fallback",
          freshness: "fresh",
          warnings: containing.length > 0 ? warnings : ["no-containing-ast-node"],
          results: containing.slice(0, limit),
          total: containing.length,
          truncated: containing.length > limit,
        });
      }

      const metadataResults = tree
        .filter((node) => metadataMatches(node, { ...args, query: args.query || "*" }))
        .map((node) => ({ ...node, matchKind: "name" }));
      if (metadataResults.length > 0 || !args.query) {
        return JSON.stringify({
          mode: "ast",
          freshness: "fresh",
          warnings,
          results: metadataResults.slice(0, limit),
          total: metadataResults.length,
          truncated: metadataResults.length > limit,
        });
      }

      const grepRes = await window.api.grep(args.query, searchPath);
      const containing = smallestContainingNodes(
        workspacePath,
        tree,
        parseGrepLines(grepRes),
        args,
      ).map((node) => ({ ...node, matchKind: "content" }));
      return JSON.stringify({
        mode: containing.length > 0 ? "ast" : "text-fallback",
        freshness: "fresh",
        warnings: containing.length > 0 ? ["metadata-miss-content-fallback"] : ["no-containing-ast-node"],
        results: containing.length > 0 ? containing.slice(0, limit) : grepRes.slice(0, limit),
        total: containing.length > 0 ? containing.length : grepRes.length,
        truncated: (containing.length > 0 ? containing.length : grepRes.length) > limit,
      });
    } catch (err) {
      return `Error in search/${args.subtool}: ${(err as Error).message}`;
    }
  },
});
