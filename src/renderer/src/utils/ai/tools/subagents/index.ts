import { registerTool, type ToolExecutionContext } from "../registry";

const MAX_AGENTS = 4;

registerTool({
  definition: {
    type: "function",
    function: {
      name: "subagents",
      description:
        "Delegate independent, bounded tasks to visible Swarm subagents and wait for their reports. Subagents receive every active tool except terminal and subagents.",
      parameters: {
        type: "object",
        properties: {
          agents: {
            type: "array",
            maxItems: MAX_AGENTS,
            items: {
              type: "object",
              properties: {
                role: { type: "string", description: "Short professional role name" },
                task: {
                  type: "string",
                  description: "Concrete objective, scope, constraints, and expected report",
                },
              },
              required: ["role", "task"],
            },
          },
          targetWorkspace: {
            type: "string",
            description: "Optional workspace-relative or absolute subdirectory",
          },
        },
        required: ["agents"],
      },
    },
  },
  execute: async (
    args: { agents: Array<{ role: string; task: string }>; targetWorkspace?: string },
    workspacePath?: string,
    _context?: ToolExecutionContext,
  ) => {
    if (!workspacePath) return "Error: subagents requires an active workspace.";
    if (!Array.isArray(args.agents) || args.agents.length === 0)
      return "Error: subagents requires at least one agent.";
    if (args.agents.length > MAX_AGENTS)
      return `Error: subagents accepts at most ${MAX_AGENTS} agents.`;
    window.dispatchEvent(new CustomEvent("codeclub:open-swarm"));
    const batchId = crypto.randomUUID();
    return await new Promise<string>((resolve) => {
      const eventName = `codeclub:subagents-result:${batchId}`;
      const onResult = (event: Event) => {
        resolve(JSON.stringify((event as CustomEvent).detail));
      };
      window.addEventListener(eventName, onResult, { once: true });
      window.dispatchEvent(
        new CustomEvent("codeclub:spawn-subagents", {
          detail: { batchId, agents: args.agents, workspacePath },
        }),
      );
    });
  },
});
