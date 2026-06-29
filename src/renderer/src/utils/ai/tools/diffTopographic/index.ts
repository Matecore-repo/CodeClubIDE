import { registerTool } from "../registry";
import { workspaceFilePath } from "../workspacePath";

registerTool({
  definition: {
    type: "function",
    function: {
      name: "diff_topographic",
      description:
        "Compare structural differences between two files or directories topographically.",
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
    try {
      if (!workspacePath) return "Error: diff_topographic requires an active workspace.";
      const aTree = await window.api.topographicTree(args.filePathA ?? workspacePath);
      const bTree = await window.api.topographicTree(args.filePathB ?? workspacePath);
      const diffs = await window.api.topographicDiffAsync(workspacePath, aTree, bTree);
      if (diffs.length === 0 && args.filePathA && args.filePathB) {
        const [a, b] = await Promise.all([
          window.api.readFile(workspaceFilePath(workspacePath, args.filePathA)),
          window.api.readFile(workspaceFilePath(workspacePath, args.filePathB)),
        ]);
        if (a !== null && b !== null && a !== b) {
          const aLines = a.split("\n");
          const bLines = b.split("\n");
          return JSON.stringify([
            {
              kind: "text-fallback",
              changed: true,
              linesA: aLines.length,
              linesB: bLines.length,
              firstDifferenceLine: firstDifference(aLines, bLines),
            },
          ]);
        }
      }
      return JSON.stringify(diffs);
    } catch (err) {
      return `Error in diff_topographic: ${(err as Error).message}`;
    }
  },
});

function firstDifference(a: string[], b: string[]): number {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) if (a[index] !== b[index]) return index + 1;
  return 0;
}
