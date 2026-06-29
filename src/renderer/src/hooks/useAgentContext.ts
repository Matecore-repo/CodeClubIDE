import { useCallback } from "react";
import { encode } from "gpt-tokenizer";
import type { ChatMessage, TurnSummary } from "./agentTypes";
import type { Message, ToolDefinition } from "../utils/ai";
import { builtInTools } from "../utils/ai";
import { sanitizeToolHistory, toAPIMessage } from "../utils/ai/messages";
import { systemPrompt } from "../utils/ai/chatPrompt";

interface PreparedContext {
  agentMessages: (Message & { id?: string })[];
  activeTools: ToolDefinition[];
  allTools: ToolDefinition[];
  usedTools: Set<string>;
  recentTools: Set<string>;
  treeInfo: number;
  turnSummary: TurnSummary;
}

export function useAgentContext(
  workspacePath?: string,
  workspaceTree?: string,
  fileContext?: string,
  sandbox?: boolean,
  planMode?: boolean,
  onStats?: (fn: (prev: any) => any) => void,
) {
  const prepareContext = useCallback(
    async (text: string, priorMsgs: ChatMessage[]): Promise<PreparedContext> => {
      let localSkills: { name: string; description: string; content: string }[] | undefined;
      if (workspacePath) {
        try {
          localSkills = await window.api.getSkills(workspacePath);
        } catch {
          /* ignore */
        }
      }

      let workspaceMemory: { key: string; value: string }[] = [];
      if (workspacePath) {
        try {
          workspaceMemory = await window.api.memoryList(workspacePath);
        } catch {
          /* ignore */
        }
      }

      let ragContext = "";
      if (workspacePath) {
        try {
          const matches = await window.api.ragSearch(workspacePath, text, 3);
          ragContext = matches
            .map(
              ({ block, score }) =>
                `[${block.name}] ${block.filePath}:${block.startLine}-${block.endLine} (score ${score.toFixed(2)})\n\`\`\`${block.language}\n${block.code}\n\`\`\``,
            )
            .join("\n\n");
        } catch {
          /* ignore */
        }
      }

      const treeTokens = workspaceTree ? encode(workspaceTree).length : 0;
      const treeInfo = treeTokens;
      onStats?.((prev) => ({
        ...prev,
        totalTreeTokens: prev.totalTreeTokens + treeTokens,
        messagesWithoutIndex: prev.messagesWithoutIndex + (workspacePath ? 1 : 0),
      }));

      const allTools = builtInTools();

      let mcpTools: any[] = [];
      try {
        const userSettings: any = await window.api.storeGet("ui", "userSettings");
        const mcpServers = userSettings?.mcpServers || [];
        if (mcpServers.length > 0) {
          mcpTools = await (window.api as any).mcpListTools(mcpServers);
        }
      } catch (e) {
        console.error("Failed to fetch MCP tools:", e);
      }

      for (const tool of mcpTools) {
        // Create a unified ToolDefinition format that our app uses.
        // In JSON schema parameters, MCP tools use `inputSchema`.
        allTools.push({
          type: "function",
          function: {
            name: tool.name,
            description:
              tool.description || `MCP Tool: ${tool.originalName} from ${tool.serverName}`,
            parameters: tool.inputSchema || { type: "object", properties: {} },
          },
        });
      }

      const activeTools = allTools;
      const usedTools = new Set<string>();
      const recentTools = new Set<string>();
      const isPlanMode = planMode !== false;

      const agentMessages: (Message & { id?: string })[] = [
        {
          role: "system",
          content: systemPrompt(
            workspacePath,
            fileContext,
            workspaceTree,
            sandbox,
            isPlanMode,
            localSkills,
            workspaceMemory,
            ragContext,
            {
              registered: allTools.length,
              active: activeTools.map((tool) => tool.function.name),
            },
          ),
        },
        ...sanitizeToolHistory(priorMsgs).map(toAPIMessage),
        { role: "user", content: text },
      ];

      return {
        agentMessages,
        activeTools,
        allTools,
        usedTools,
        recentTools,
        treeInfo,
        turnSummary: { toolNames: [], totalCharsRead: 0 },
      };
    },
    [workspacePath, workspaceTree, fileContext, sandbox, planMode, onStats],
  );

  return { prepareContext };
}
