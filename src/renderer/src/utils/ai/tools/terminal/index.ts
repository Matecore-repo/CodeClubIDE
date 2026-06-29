import { registerTool, type ToolExecutionContext } from "../registry";

const MAX_OUTPUT_CHARS = 4000;

registerTool({
  definition: {
    type: "function",
    function: {
      name: "terminal",
      description:
        "Run a non-interactive command from the active workspace. Use for builds, tests, package scripts, and version control; never for file CRUD.",
      parameters: {
        type: "object",
        properties: {
          subtool: {
            type: "string",
            enum: ["rust"],
            description: "Terminal implementation to invoke",
          },
          command: { type: "string", description: "Command to execute from the workspace root" },
          affectedFiles: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional. List of file paths that this command is expected to modify, so the IDE can snapshot them before execution.",
          },
        },
        required: ["subtool", "command"],
      },
    },
  },
  execute: async (
    args: { subtool: "rust"; command: string; affectedFiles?: string[] },
    workspacePath?: string,
    context?: ToolExecutionContext,
  ) => {
    if (!workspacePath) return "Error: terminal/rust requires an active workspace.";
    try {
      if (args.affectedFiles && context?.captureFile) {
        for (const file of args.affectedFiles) {
          await context.captureFile(file);
        }
      }
      const result = await window.api.execCommand(
        args.command,
        workspacePath,
        false,
        context?.runId,
      );
      const stdout = truncate((result.stdout ?? "").trim());
      const stderr = truncate((result.stderr ?? "").trim());
      return JSON.stringify({
        ok: result.exitCode === 0,
        exitCode: result.exitCode ?? 0,
        stdout: stdout.text,
        stderr: stderr.text,
        truncated: stdout.omittedChars + stderr.omittedChars > 0,
        omittedChars: stdout.omittedChars + stderr.omittedChars,
      });
    } catch (err) {
      return `Error in terminal/rust: ${(err as Error).message}`;
    }
  },
});

function truncate(value: string): { text: string; omittedChars: number } {
  if (value.length <= MAX_OUTPUT_CHARS) return { text: value, omittedChars: 0 };
  const omittedChars = value.length - MAX_OUTPUT_CHARS;
  return {
    text: `${value.slice(0, MAX_OUTPUT_CHARS)}\n[Terminal output truncated: omitted ${omittedChars} chars.]`,
    omittedChars,
  };
}
