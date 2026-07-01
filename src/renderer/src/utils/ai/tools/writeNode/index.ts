import { registerTool } from "../registry";
import { workspaceFilePath } from "../workspacePath";

registerTool({
  definition: {
    type: "function",
    function: {
      name: "write",
      description: "Write a whole file or create/insert through the AST tree.",
      parameters: {
        type: "object",
        properties: {
          subtool: { type: "string", enum: ["classic", "rust"] },
          filePath: { type: "string" },
          content: { type: "string" },
          operation: { type: "string", enum: ["create-file", "create-folder", "insert"] },
          startLine: { type: "number" },
          baseHash: { type: "string" },
        },
        required: ["subtool", "filePath"],
      },
    },
  },
  execute: async (
    args: {
      subtool: "classic" | "rust";
      filePath: string;
      content?: string;
      operation?: "create-file" | "create-folder" | "insert";
      startLine?: number;
      baseHash?: string;
    },
    workspacePath,
    context,
  ) => {
    try {
      if (!args.operation || args.operation !== "create-folder")
        await context?.captureFile?.(args.filePath);

      if (args.subtool === "classic")
        return JSON.stringify({
          ok: await window.api.writeFile(
            workspaceFilePath(workspacePath, args.filePath),
            args.content ?? "",
          ),
        });
      if (!workspacePath) return "Error: write/rust requires an active workspace.";
      const action = args.operation ?? "create-file";
      if (action === "create-file" && args.content == null)
        return "Error: write/rust create-file requires content.";
      const mutation =
        action === "insert"
          ? ({
              action,
              path: args.filePath,
              content: args.content ?? "",
              startLine: args.startLine,
              baseHash: args.baseHash,
            } as const)
          : ({ action, path: args.filePath, content: args.content } as const);
      const result = await window.api.topographicMutate({ workspacePath, mutation });
      return result.ok
        ? JSON.stringify({ mode: "ast", freshness: "fresh", warnings: [], ...result })
        : mutationError(result);
    } catch (err) {
      return `Error in write/${args.subtool}: ${(err as Error).message}`;
    }
  },
});

function mutationError(result: { error: string; currentHash?: string }): string {
  return result.error === "hash-conflict"
    ? `Error: hash-conflict. Re-read the target and retry with baseHash ${result.currentHash}.`
    : `Error: ${result.error}`;
}
