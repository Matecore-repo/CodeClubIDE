import type { Message } from "./types";

export interface CachingStrategyResult {
  processedMessages: any[];
  headers?: Record<string, string>;
}

export function applyPromptCaching(messages: Message[], model: string): CachingStrategyResult {
  const isClaude = (model || "").toLowerCase().includes("claude");
  const safeMessages = messages || [];

  if (!isClaude || safeMessages.length === 0) {
    return { processedMessages: safeMessages };
  }

  const processedMessages = safeMessages.map((msg, index) => {
    if (msg.role === "system" && typeof msg.content === "string") {
      return {
        ...msg,
        content: [
          {
            type: "text" as const,
            text: msg.content,
            cache_control: { type: "ephemeral" as const },
          },
        ],
      };
    }

    const isCacheTarget = index === messages.length - 2 && messages.length > 2;
    if (isCacheTarget && typeof msg.content === "string" && msg.content.length > 1000) {
      return {
        ...msg,
        content: [
          {
            type: "text" as const,
            text: msg.content,
            cache_control: { type: "ephemeral" as const },
          },
        ],
      };
    }

    return msg;
  });

  return {
    processedMessages,
    headers: { "anthropic-beta": "prompt-caching-2024-07-31" },
  };
}
