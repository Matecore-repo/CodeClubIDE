import { registerTool } from "../registry";
import { workspaceFilePath } from "../workspacePath";

type AstMutation = Record<string, any>;

async function retryDryRunWithFreshHash(
  workspacePath: string,
  mutation: AstMutation,
): Promise<any | null> {
  const fresh = (await window.api.topographicRead({
    workspacePath,
    path: mutation.path,
    nodeId: mutation.nodeId,
    startLine: mutation.startLine,
    endLine: mutation.endLine,
  })) as any;
  if (!fresh || fresh.error || !fresh.hash) return null;
  return window.api.topographicMutate({
    workspacePath,
    mutation: { ...mutation, baseHash: fresh.hash } as any,
  });
}

registerTool({
  definition: {
    type: "function",
    function: {
      name: "edit",
      description:
        "Edit text or an AST node. For rust, nodeName can replace nodeId/hash/ranges; metadata is resolved automatically. If structural editing fails and oldContent is provided, edit falls back safely to classic exact replacement.",
      parameters: {
        type: "object",
        properties: {
          subtool: { type: "string", enum: ["classic", "rust"] },
          filePath: { type: "string" },
          oldContent: { type: "string" },
          content: { type: "string" },
          operation: {
            type: "string",
            enum: ["replace", "insert", "rename", "move", "move-node", "undo"],
          },
          destination: { type: "string" },
          nodeId: { type: "string" },
          nodeName: { type: "string", description: "AST node name when its ID is unknown" },
          startLine: { type: "number" },
          endLine: { type: "number" },
          baseHash: { type: "string" },
          destinationLine: { type: "number" },
          targetHash: { type: "string" },
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
      oldContent?: string;
      content?: string;
      operation?: "replace" | "insert" | "rename" | "move" | "move-node" | "undo";
      destination?: string;
      nodeId?: string;
      nodeName?: string;
      startLine?: number;
      endLine?: number;
      baseHash?: string;
      dryRun?: boolean;
      destinationLine?: number;
      targetHash?: string;
    },
    workspacePath,
    context,
  ) => {
    try {
      if (!args.dryRun) await context?.captureFile?.(args.filePath);

      if (args.subtool === "classic") {
        if (!args.oldContent) return "Error: edit/classic requires oldContent.";
        const filePath = workspaceFilePath(workspacePath, args.filePath);
        const current = await window.api.readFile(filePath);
        if (current == null) return "Error: file-not-found.";
        const at = current.indexOf(args.oldContent);
        if (at < 0 || current.indexOf(args.oldContent, at + args.oldContent.length) >= 0)
          return "Error: oldContent must occur exactly once.";
        const result = await window.api.editFile(filePath, args.oldContent, args.content ?? "");
        return JSON.stringify({ ok: result.ok, error: result.error });
      }

      if (!workspacePath) return "Error: edit/rust requires workspace.";
      const action = args.operation ?? "replace";
      const destination = args.destination ?? args.content;
      if (action === "insert" && args.content == null)
        return "Error: edit/rust insert requires content.";
      if (action !== "replace" && action !== "undo" && !destination)
        return `Error: edit/rust ${action} requires destination or content.`;

      if (!args.nodeId && args.nodeName) {
        const tree = await window.api.topographicTree(workspacePath);
        const normalizedPath = args.filePath.replace(/\\/g, "/");
        const matches = tree.filter(
          (node: any) =>
            node.name === args.nodeName && node.path.replace(/\\/g, "/").endsWith(normalizedPath),
        );
        if (matches.length === 1) {
          args.nodeId = matches[0].id;
          args.startLine ??= matches[0].startLine;
          args.endLine ??= matches[0].endLine;
          args.baseHash ??= matches[0].hash;
        } else if (matches.length > 1) {
          return JSON.stringify({
            ok: false,
            error: "ambiguous-nodeName",
            candidates: matches.slice(0, 10).map((node: any) => ({
              id: node.id,
              name: node.name,
              type: node.type,
              path: node.path,
              startLine: node.startLine,
              endLine: node.endLine,
              hash: node.hash,
            })),
          });
        }
      }

      let mutation: any;
      if (action === "replace") {
        mutation = {
          action,
          path: args.filePath,
          content: args.content ?? "",
          oldContent: args.oldContent,
          nodeId: args.nodeId,
          nodeName: args.nodeName,
          startLine: args.startLine,
          endLine: args.endLine,
          baseHash: args.baseHash,
          dryRun: args.dryRun,
        };
      } else if (action === "insert") {
        mutation = {
          action,
          path: args.filePath,
          content: args.content ?? "",
          startLine: args.startLine,
          baseHash: args.baseHash,
          dryRun: args.dryRun,
        };
      } else if (action === "undo") {
        mutation = {
          action,
          path: args.filePath,
          targetHash: args.targetHash,
          nodeId: args.nodeId,
          nodeName: args.nodeName,
          dryRun: args.dryRun,
        };
      } else if (action === "move-node") {
        mutation = {
          action,
          path: args.filePath,
          destinationPath: destination!,
          nodeId: args.nodeId,
          nodeName: args.nodeName,
          startLine: args.startLine,
          endLine: args.endLine,
          destinationLine: args.destinationLine,
          baseHash: args.baseHash,
          dryRun: args.dryRun,
        };
      } else {
        mutation = {
          action,
          path: args.filePath,
          destination: destination!,
          baseHash: args.baseHash,
        };
      }

      let result: any = await window.api.topographicMutate({ workspacePath, mutation });
      if (args.dryRun && !result.ok && result.error === "hash-conflict") {
        const retry = await retryDryRunWithFreshHash(workspacePath, mutation);
        if (retry) result = retry.ok ? { ...retry, freshness: "stale-retried" } : retry;
      }
      if (!result.ok) {
        if (
          action === "replace" &&
          args.oldContent &&
          !args.dryRun &&
          result.error !== "hash-conflict"
        ) {
          const filePath = workspaceFilePath(workspacePath, args.filePath);
          const fallback = await window.api.editFile(filePath, args.oldContent, args.content ?? "");
          return JSON.stringify({
            ...fallback,
            fallback: "classic",
            topographicError: result.error,
          });
        }
        return result.error === "hash-conflict"
          ? `Error: hash-conflict. Re-read the target and retry with baseHash ${result.currentHash}.`
          : `Error: ${result.error}`;
      }
      return JSON.stringify({
        mode: "ast",
        freshness: result.freshness ?? "fresh",
        warnings: [],
        ...result,
      });
    } catch (err) {
      return `Error in edit/${args.subtool}: ${(err as Error).message}`;
    }
  },
});
