import type { ToolCall, UsageInfo } from "../utils/ai";

export interface TurnSummary {
  toolNames: string[];
  totalCharsRead: number;
}

export interface ChatMessage {
  id: string;
  turnId?: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  toolName?: string;
  usage?: UsageInfo;
  treeInfo?: number;
  turnSummary?: TurnSummary;
  cancelled?: boolean;
  pending?: boolean;
  checkpointId?: string;
  checkpointFilesCaptured?: boolean;
}

export interface SessionStats {
  totalTreeTokens: number;
  totalChunkTokens: number;
  messagesWithIndex: number;
  messagesWithoutIndex: number;
  semanticGreps: number;
}

export interface AgentPlan {
  scope: string;
  title: string;
  steps: { text: string; status: string }[];
}

export interface AgentTodo {
  title: string;
  tasks: { text: string; status: string }[];
}

export interface RelevantChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  code: string;
  score: number;
}

export interface FileDiff {
  filePath: string;
  diff: string;
}
