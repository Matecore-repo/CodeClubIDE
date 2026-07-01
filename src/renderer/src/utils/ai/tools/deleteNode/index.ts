import { registerTool, type ToolExecutionContext } from "../registry";
import { workspaceFilePath } from "../workspacePath";

registerTool({
  definition: {
    type: "function",
    function: {
      name: "delete",
      description: "Delete a file classically or an AST file, folder, node, or line range.",
      parameters: {
        type: "object",
        properties: {
          subtool: { type: "string", enum: ["classic", "rust"] },
          filePath: { type: "string" },
          nodeId: { type: "string" },
          startLine: { type: "number" },
          endLine: { type: "number" },
          baseHash: { type: "string" },
          isFolder: { type: "boolean" },
          dryRun: {
            type: "boolean",
            description: "If true, returns the matched replaced text without modifying the file",
          },
        },
        required: ["subtool", "filePath"],
      },
    },
  },
  execute: async (
    args: {
      subtool: "classic" | "rust";
      filePath: string;
      nodeId?: string;
      startLine?: number;
      endLine?: number;
      baseHash?: string;
      isFolder?: boolean;
      dryRun?: boolean;
    },
    workspacePath,
    context?: ToolExecutionContext,
  ) => {
    try {
      if (!args.dryRun) await context?.captureFile?.(args.filePath);

      if (args.subtool === "classic")
        return JSON.stringify({
          ok: await window.api.deleteFile(workspaceFilePath(workspacePath, args.filePath)),
        });
      if (!workspacePath) return "Error: delete/rust requires workspace.";
      if (args.isFolder && !args.dryRun) {
        if (!context?.askUser) return "Error: deleting a folder requires HITL confirmation.";
        const answer = await context.askUser([
          {
            header: "Delete folder",
            question: `Delete ${args.filePath} recursively?`,
            type: "yesno",
          },
        ]);
        if (String(answer[0]).toLowerCase() !== "yes")
          return "Cancelled: folder deletion was not confirmed.";
      }
      const result = await window.api.topographicMutate({
        workspacePath,
        mutation: {
          action: "delete",
          path: args.filePath,
          nodeId: args.nodeId,
          startLine: args.startLine,
          endLine: args.endLine,
          baseHash: args.baseHash,
          dryRun: args.dryRun,
        },
      });
      if (!result.ok)
        return result.error === "hash-conflict"
          ? `Error: hash-conflict. Re-read the target and retry with baseHash ${result.currentHash}.`
          : `Error: ${result.error}`;
      return JSON.stringify({ mode: "ast", freshness: "fresh", warnings: [], ...result });
    } catch (err) {
      return `Error in delete/${args.subtool}: ${(err as Error).message}`;
    }
  },
});
