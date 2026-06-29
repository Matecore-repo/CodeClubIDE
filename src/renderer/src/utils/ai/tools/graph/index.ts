import { registerTool } from "../registry";
import { workspaceFilePath } from "../workspacePath";

registerTool({
  definition: {
    type: "function",
    function: {
      name: "graph",
      description: "Native CodeClub code graph analysis: architecture, impact, and graph queries.",
      parameters: {
        type: "object",
        properties: {
          subtool: {
            type: "string",
            enum: ["architecture", "impact", "query", "snapshot", "snapshot-import"],
          },
          targetPath: {
            type: "string",
            description: "File path or symbol name for impact analysis",
          },
          pathPattern: { type: "string", description: "Regex path filter for query" },
          namePattern: { type: "string", description: "Symbol name filter for query" },
          scope: { type: "string", enum: ["files", "symbols", "routes"] },
          relation: { type: "string", enum: ["callers", "callees"] },
          kind: { type: "string", description: "Graph node kind, usually file/dir/root" },
          minImports: { type: "number" },
          minImportedBy: { type: "number" },
          limit: { type: "number" },
        },
        required: ["subtool"],
      },
    },
  },
  execute: async (
    args: {
      subtool: "architecture" | "impact" | "query" | "snapshot" | "snapshot-import";
      targetPath?: string;
      pathPattern?: string;
      namePattern?: string;
      scope?: "files" | "symbols" | "routes";
      relation?: "callers" | "callees";
      kind?: string;
      minImports?: number;
      minImportedBy?: number;
      limit?: number;
    },
    workspacePath,
  ) => {
    if (!workspacePath) return "Error: graph requires an active workspace.";

    if (args.subtool === "architecture") {
      return JSON.stringify(await window.api.indexingArchitecture(workspacePath));
    }

    if (args.subtool === "impact") {
      if (!args.targetPath) return "Error: graph/impact requires targetPath.";
      const looksLikePath =
        /[\\/]/.test(args.targetPath) || /\.[A-Za-z0-9]+$/.test(args.targetPath);
      const targetPath = looksLikePath
        ? workspaceFilePath(workspacePath, args.targetPath).replace(/\\/g, "/")
        : args.targetPath;
      return JSON.stringify(await window.api.indexingImpact(workspacePath, targetPath));
    }

    if (args.subtool === "snapshot") {
      return JSON.stringify({ path: await window.api.indexingExportGraphSnapshot(workspacePath) });
    }

    if (args.subtool === "snapshot-import") {
      return JSON.stringify({ ok: await window.api.indexingImportGraphSnapshot(workspacePath) });
    }

    return JSON.stringify(
      await window.api.indexingQueryGraph(workspacePath, {
        pathPattern: args.pathPattern,
        namePattern: args.namePattern,
        scope: args.scope,
        relation: args.relation,
        kind: args.kind,
        minImports: args.minImports,
        minImportedBy: args.minImportedBy,
        limit: args.limit,
      }),
    );
  },
});
