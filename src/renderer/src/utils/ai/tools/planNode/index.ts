import { registerTool } from "../registry";

registerTool({
  definition: {
    type: "function",
    function: {
      name: "update_plan",
      description:
        "Manage the long-term, high-level execution plan. Use this tool ONLY to define or update the macro strategy. For immediate, dynamic task lists, use update_todo instead. Send the entire updated plan steps each time.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the plan (e.g. 'Refactor Auth System')" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "High-level goal description" },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "Current status of this goal",
                },
              },
              required: ["text", "status"],
            },
          },
        },
        required: ["title", "steps"],
      },
    },
  },
  execute: async (args, workspacePath, context) => {
    if (!context?.onPlanUpdate) {
      return "Plan tracking is not available in this context.";
    }

    // Main agent uses 'main' scope for plans.
    context.onPlanUpdate("main", args.title, args.steps);

    return `Plan updated successfully with ${args.steps.length} steps.`;
  },
});
