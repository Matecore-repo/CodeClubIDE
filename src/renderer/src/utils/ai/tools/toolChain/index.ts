import { getTool, registerTool, type ToolExecutionContext } from "../registry";
import { workspaceFilePath } from "../workspacePath";

const ALLOWED_TOOLS = new Set(["read", "write", "edit", "delete"]);
const MAX_STEPS = 8;

registerTool({
  definition: {
    type: "function",
    function: {
      name: "tool_chain",
      description:
        "Run a short sequential chain of read, write, edit, and delete operations using one consistent classic or rust subtool.",
      parameters: {
        type: "object",
        properties: {
          subtool: {
            type: "string",
            enum: ["classic", "rust"],
            description: "Subtool injected into every step",
          },
          steps: {
            type: "array",
            maxItems: MAX_STEPS,
            items: {
              type: "object",
              properties: {
                tool: { type: "string", enum: ["read", "write", "edit", "delete"] },
                args: {
                  type: "object",
                  description: "Arguments for the selected tool, excluding subtool",
                },
              },
              required: ["tool", "args"],
            },
          },
          stopOnError: {
            type: "boolean",
            description: "Stop after the first failed step; defaults to true",
          },
        },
        required: ["subtool", "steps"],
      },
    },
  },
  execute: async (
    args: {
      subtool: "classic" | "rust";
      steps: Array<{ tool: string; args: Record<string, unknown> }>;
      stopOnError?: boolean;
    },
    workspacePath?: string,
    context?: ToolExecutionContext,
  ) => {
    if (!Array.isArray(args.steps) || args.steps.length === 0)
      return "Error: tool_chain requires at least one step.";
    if (args.steps.length > MAX_STEPS)
      return `Error: tool_chain accepts at most ${MAX_STEPS} steps.`;
    const results: Array<{ index: number; tool: string; ok: boolean; result: string }> = [];

    if (
      args.subtool === "classic" &&
      args.stopOnError !== false &&
      args.steps.some((step) => step.tool === "edit") &&
      args.steps.every((step) => step.tool === "read" || step.tool === "edit")
    ) {
      const simulated = new Map<string, string>();
      for (const step of args.steps.filter((item) => item.tool === "edit")) {
        const filePath = workspaceFilePath(workspacePath, String(step.args.filePath ?? ""));
        const oldContent = String(step.args.oldContent ?? "");
        const current = simulated.get(filePath) ?? (await window.api.readFile(filePath));
        if (current == null)
          return "Error: tool_chain preflight file-not-found. No changes applied.";
        const at = oldContent ? current.indexOf(oldContent) : -1;
        if (at < 0 || current.indexOf(oldContent, at + oldContent.length) >= 0)
          return "Error: tool_chain preflight requires each oldContent exactly once. No changes applied.";
        simulated.set(
          filePath,
          current.slice(0, at) +
            String(step.args.content ?? "") +
            current.slice(at + oldContent.length),
        );
      }
    }

    for (const [index, step] of args.steps.entries()) {
      if (!ALLOWED_TOOLS.has(step.tool)) return `Error: tool_chain does not allow '${step.tool}'.`;
      const tool = getTool(step.tool);
      if (!tool) return `Error: tool_chain could not resolve '${step.tool}'.`;
      const result = await tool.execute(
        { ...step.args, subtool: args.subtool },
        workspacePath,
        context,
      );
      const ok =
        !result.startsWith("Error:") &&
        !result.startsWith("Error in ") &&
        !result.includes('"ok":false');
      results.push({ index, tool: step.tool, ok, result });
      if (!ok && args.stopOnError !== false) break;
    }
    return JSON.stringify({
      ok: results.every((result) => result.ok),
      subtool: args.subtool,
      results,
    });
  },
});
