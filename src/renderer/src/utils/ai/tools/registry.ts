import type { AIConfig, ToolDefinition, ToolCall } from "../types";

export interface ToolExecutionContext {
  config?: AIConfig;
  signal?: AbortSignal;
  sandbox?: boolean;
  onProgress?: (message: string) => void;
  planScope?: string;
  onPlanUpdate?: (scope: string, title: string, steps: { text: string; status: string }[]) => void;
  onTodoUpdate?: (title: string, tasks: { text: string; status: string }[]) => void;
  sessionKey?: string;
  askUser?: (questions: any[]) => Promise<any[]>;
  runId?: string;
  checkpointId?: string;
  captureFile?: (path: string) => Promise<void>;
}

export type ToolExecutor = (
  args: any,
  workspacePath?: string,
  context?: ToolExecutionContext,
) => Promise<string>;

export interface RegisteredTool {
  definition: ToolDefinition;
  execute: ToolExecutor;
}

const registry: Record<string, RegisteredTool> = {};
const MAX_TOOL_RESULT_CHARS = 6000;

export function registerTool(tool: RegisteredTool) {
  registry[tool.definition.function.name] = tool;
}

export function getTool(name: string): RegisteredTool | undefined {
  return registry[name];
}

export function deregisterTool(name: string): boolean {
  if (registry[name]) {
    delete registry[name];
    return true;
  }
  return false;
}

export function getAllToolDefinitions(): ToolDefinition[] {
  return Object.values(registry).map((t) => t.definition);
}

export function getRegisteredToolsCount(): number {
  return Object.keys(registry).length;
}

export async function executeRegisteredTool(
  call: ToolCall,
  workspacePath?: string,
  context?: ToolExecutionContext,
): Promise<string> {
  // Route MCP tool calls
  if (call.function.name.startsWith("mcp_")) {
    try {
      const match = call.function.name.match(/^mcp_(.+?)_(.+)$/);
      if (!match) return `Error: Invalid MCP tool name format.`;
      const serverName = match[1];
      const toolName = match[2];

      const args = JSON.parse(call.function.arguments);
      const response: any = await (window.api as any).mcpCallTool(serverName, toolName, args);

      if (response.isError) {
        return truncateToolResult(
          `MCP Tool Error: ${response.content?.map((c: any) => c.text).join("\n") || "Unknown error"}`,
        );
      }

      const textResponse = response.content?.map((c: any) => c.text).join("\n");
      return truncateToolResult(textResponse || "Done.");
    } catch (err: any) {
      return `MCP Error: ${err.message}`;
    }
  }

  const tool = getTool(call.function.name);
  if (!tool) {
    return `Unknown tool: ${call.function.name}`;
  }
  try {
    const args = JSON.parse(call.function.arguments);
    return truncateToolResult(await tool.execute(args, workspacePath, context));
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return `Error executing ${call.function.name}: ${(err as Error).message}`;
  }
}

function truncateToolResult(value: string): string {
  if (value.length <= MAX_TOOL_RESULT_CHARS) return value;
  const omitted = value.length - MAX_TOOL_RESULT_CHARS;
  return `${value.slice(0, MAX_TOOL_RESULT_CHARS)}\n\n[Tool result truncated: omitted ${omitted} chars. Narrow the query or use a more specific tool call.]`;
}
