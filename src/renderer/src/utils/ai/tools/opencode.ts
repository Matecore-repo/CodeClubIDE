import type { Message, ToolDefinition } from "../types";

export function formatTools(tools?: ToolDefinition[]): unknown {
  return tools;
}

export function formatMessages(messages: Message[]): Message[] {
  return messages;
}
