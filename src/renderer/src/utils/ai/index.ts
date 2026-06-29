export { streamChatCompletion } from "./chat";
export { fetchModelCatalog, catalogToModelInfos, providerSupportsReasoning } from "./catalog";
export { filterProviderModels, providerModelSupportsReasoning } from "./providers/registry";

// Import all providers to trigger registration
import "./providers/openai";
import "./providers/openrouter";
import "./providers/opencode-go";
import "./providers/opencode-zen";
import "./providers/local";
import "./providers/lmstudio";
import "./providers/anthropic";
import "./providers/gemini";

export type {
  AIConfig,
  ToolDefinition,
  ToolCall,
  Message,
  StreamEvent,
  UsageInfo,
  ModelInfo,
  ModelCatalog,
} from "./types";
export { maxContext } from "./types";
export { toAPIMessage, shouldCompact, compactMessages } from "./messages";
export type { StableContextSummary } from "./compaction";

export { builtInTools, executeRegisteredTool } from "./tools/index";

export * from "./core";
