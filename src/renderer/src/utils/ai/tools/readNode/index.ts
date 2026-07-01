import { registerTool } from "../registry";
import { workspaceFilePath } from "../workspacePath";
import { topographicIdMap, resolveTopographicId } from "../topographicCache";

const nodeReadFailures = new Map<string, number>();

registerTool({
  definition: {
    type: "function",
    function: {
      name: "read",
      description: "Read files using classic whole-file access or the deterministic AST tree.",
      parameters: {
        type: "object",
        properties: {
          subtool: { type: "string", enum: ["classic", "rust"] },
          filePath: { type: "string" },
          nodeId: { type: "string" },
          operation: { type: "string", enum: ["tree", "content"] },
          startLine: { type: "number" },
          endLine: { type: "number" },
        },
        required: ["subtool"],
      },
    },
  },
  execute: async (
    args: {
      subtool: "classic" | "rust";
      filePath?: string;
      nodeId?: string;
      operation?: "tree" | "content";
      startLine?: number;
      endLine?: number;
    },
    workspacePath,
  ) => {
    try {
      if (args.subtool === "classic") {
        if (!args.filePath) return "Error: read/classic requires filePath.";
        const content = await window.api.readFile(workspaceFilePath(workspacePath, args.filePath));
        if (content == null) return `Error: Cannot read ${args.filePath}.`;
        if (args.startLine == null && args.endLine == null) return content;
        const lines = content.split("\n");
        const start = args.startLine ?? 1;
        const end = Math.min(args.endLine ?? lines.length, lines.length);
        if (start < 1 || start > lines.length || end < start)
          return "Error: read/classic range-out-of-bounds.";
        return lines.slice(start - 1, end).join("\n");
      }
      if (!workspacePath) return "Error: read/rust requires an active workspace.";
      const operation =
        args.operation ?? (args.filePath && args.filePath !== "." ? "content" : "tree");
      if (operation === "tree") {
        topographicIdMap.clear();

        const tree = await window.api.topographicTree(workspacePath);
        const nodes =
          args.filePath && args.filePath !== "."
            ? tree.filter((n) => n.path === args.filePath || n.path.startsWith(args.filePath + "/"))
            : tree;

        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
        const childMap = new Map<string, string[]>();
        const roots: string[] = [];

        for (const n of nodes) {
          if (!n.parentId || !nodeMap.has(n.parentId)) roots.push(n.id);
          else {
            if (!childMap.has(n.parentId)) childMap.set(n.parentId, []);
            childMap.get(n.parentId)!.push(n.id);
          }
        }

        const compressed: any[] = [];
        let rootIdx = 1;
        const traverse = (id: string, prefix: string) => {
          topographicIdMap.set(prefix, id);
          const n = nodeMap.get(id)!;
          compressed.push({ id: prefix, name: n.name, hash: `${n.type}_${n.hash}` });
          const children = childMap.get(id) || [];
          let childIdx = 1;
          for (const c of children) traverse(c, `${prefix}.${childIdx++}`);
        };

        for (const r of roots) traverse(r, `${rootIdx++}`);

        return JSON.stringify(compressed);
      }
      const failureKey = `${workspacePath}:${args.filePath ?? ""}`;
      if (args.nodeId && (nodeReadFailures.get(failureKey) ?? 0) >= 2)
        return "Error in read/rust: node retry limit reached; omit nodeId and read with startLine/endLine.";

      const realNodeId = args.nodeId ? resolveTopographicId(args.nodeId) : undefined;

      const result = await window.api.topographicRead({
        workspacePath,
        path: args.filePath,
        nodeId: realNodeId,
        startLine: args.startLine,
        endLine: args.endLine,
      });
      if ("error" in result) {
        if (result.error === "folder-has-no-content") {
          topographicIdMap.clear();
          const tree = await window.api.topographicTree(workspacePath);
          const nodes =
            args.filePath && args.filePath !== "."
              ? tree.filter(
                  (n) => n.path === args.filePath || n.path.startsWith(args.filePath + "/"),
                )
              : tree;
          const nodeMap = new Map(nodes.map((n) => [n.id, n]));
          const childMap = new Map<string, string[]>();
          const roots: string[] = [];
          for (const n of nodes) {
            if (!n.parentId || !nodeMap.has(n.parentId)) roots.push(n.id);
            else {
              if (!childMap.has(n.parentId)) childMap.set(n.parentId, []);
              childMap.get(n.parentId)!.push(n.id);
            }
          }
          const compressed: any[] = [];
          let rootIdx = 1;
          const traverse = (id: string, prefix: string) => {
            topographicIdMap.set(prefix, id);
            const n = nodeMap.get(id)!;
            compressed.push({ id: prefix, name: n.name, hash: `${n.type}_${n.hash}` });
            const children = childMap.get(id) || [];
            let childIdx = 1;
            for (const c of children) traverse(c, `${prefix}.${childIdx++}`);
          };
          for (const r of roots) traverse(r, `${rootIdx++}`);
          return JSON.stringify(compressed);
        }
        if (args.nodeId && result.error === "node-not-found") {
          const failures = Math.min((nodeReadFailures.get(failureKey) ?? 0) + 1, 2);
          nodeReadFailures.set(failureKey, failures);
          return `Error in read/rust: node-not-found (${failures}/2); refresh the node ID or omit nodeId and use startLine/endLine.`;
        }
        return `Error in read/rust: ${result.error}`;
      }
      nodeReadFailures.delete(failureKey);
      return JSON.stringify(result);
    } catch (err) {
      const message = (err as Error).message;
      if (args.subtool === "rust" && args.nodeId && message.includes("node-not-found")) {
        const failureKey = `${workspacePath}:${args.filePath ?? ""}`;
        const failures = Math.min((nodeReadFailures.get(failureKey) ?? 0) + 1, 2);
        nodeReadFailures.set(failureKey, failures);
        return `Error in read/rust: node-not-found (${failures}/2); refresh the node ID or omit nodeId and use startLine/endLine.`;
      }
      return `Error in read/${args.subtool}: ${message}`;
    }
  },
});
