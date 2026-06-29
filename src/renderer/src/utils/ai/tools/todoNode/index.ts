import { registerTool } from "../registry";

registerTool({
  definition: {
    type: "function",
    function: {
      name: "update_todo",
      description:
        "Manage the dynamic, short-term task list (To-Do). Use this tool to track specific immediate actions (e.g. 'update file X', 'run test Y'). Send the entire updated list of tasks each time.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the current task batch or context (e.g. 'Refactoring Session')",
          },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "Specific action description" },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "Current status of this task",
                },
              },
              required: ["text", "status"],
            },
          },
        },
        required: ["title", "tasks"],
      },
    },
  },
  execute: async (args, workspacePath, context) => {
    if (!context?.onTodoUpdate) {
      return "To-Do tracking is not available in this context.";
    }

    context.onTodoUpdate(args.title, args.tasks);

    return `To-Do list updated successfully with ${args.tasks.length} tasks.`;
  },
});
