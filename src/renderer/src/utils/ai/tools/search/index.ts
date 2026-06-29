import { registerTool } from "../registry";
import { workspaceFilePath } from "../workspacePath";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

registerTool({
  definition: {
    type: "function",
    function: {
      name: "search",
      description: "Search file text with classic grep or topographic node metadata.",
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
          nodeType: { type: "string", description: "Optional topographic node type" },
          language: { type: "string", description: "Optional topographic language" },
          contentPattern: {
            type: "string",
            description: "Regex to filter topographic nodes by their actual textual content",
          },
          limit: { type: "number", description: "Maximum results; defaults to 50 and caps at 200" },
        },
        required: ["subtool", "query"],
      },
    },
  },
  execute: async (
    args: {
      subtool: "classic-rust" | "rust";
      query: string;
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
        const results = await window.api.grep(args.query, searchPath);
        return JSON.stringify({
          results: results.slice(0, limit),
          total: results.length,
          truncated: results.length > limit,
        });
      }

      let linesByFile: Record<string, number[]> | null = null;
      if (args.contentPattern) {
        const grepRes = await window.api.grep(args.contentPattern, searchPath);
        linesByFile = {};
        for (const line of grepRes) {
          const match = line.match(/^(.+?):(\d+):/);
          if (match) {
            const f = match[1].replace(/\\/g, "/");
            const l = parseInt(match[2], 10);
            if (!linesByFile[f]) linesByFile[f] = [];
            linesByFile[f].push(l);
          }
        }
      }

      const queryRegex = new RegExp(
        args.query.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"),
        "i",
      );
      let matches = (await window.api.topographicTree(searchPath)).filter((node) => {
        if (!queryRegex.test(node.name)) return false;
        if (args.nodeType && node.type !== args.nodeType) return false;
        if (args.language && node.language.toLowerCase() !== args.language.toLowerCase())
          return false;

        if (linesByFile) {
          const fileLines = linesByFile[node.path.replace(/\\/g, "/")];
          if (!fileLines) return false;
          if (node.type === "file" || node.type === "workspace" || node.type === "folder")
            return true;
          return fileLines.some((l) => l >= node.startLine && l <= node.endLine);
        }
        return true;
      });

      return JSON.stringify({
        results: matches.slice(0, limit),
        total: matches.length,
        truncated: matches.length > limit,
      });
    } catch (err) {
      return `Error in search/${args.subtool}: ${(err as Error).message}`;
    }
  },
});
