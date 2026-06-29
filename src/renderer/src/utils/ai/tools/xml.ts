import type { Message, ToolCall, ToolDefinition } from "../types";

export function xmlToolInstructions(tools: ToolDefinition[]): string {
  return `\n<tools>\n${tools.map((tool) => `<tool><name>${tool.function.name}</name><description>${tool.function.description}</description><parameters>${JSON.stringify(tool.function.parameters)}</parameters></tool>`).join("\n")}\n</tools>\nTo call a tool respond only with <tool_call><name>tool_name</name><arguments>{"key":"value"}</arguments></tool_call>.`;
}

export function withXmlTools(messages: Message[], tools?: ToolDefinition[]): Message[] {
  if (!tools?.length) return messages;
  const instructions = xmlToolInstructions(tools);
  const systemIndex = messages.findIndex((message) => message.role === "system");
  if (systemIndex < 0) return [{ role: "system", content: instructions }, ...messages];
  return messages.map((message, index) =>
    index === systemIndex ? { ...message, content: message.content + instructions } : message,
  );
}

export function parseXmlToolCalls(content: string): { content: string; calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  const pattern =
    /<tool_call>\s*<name>([^<]+)<\/name>\s*<arguments>([\s\S]*?)<\/arguments>\s*<\/tool_call>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    try {
      JSON.parse(match[2].trim());
      calls.push({
        id: `xml_${calls.length + 1}`,
        type: "function",
        function: { name: match[1].trim(), arguments: match[2].trim() },
      });
    } catch {
      /* invalid XML call stays as text */
    }
  }
  return { content: calls.length ? content.replace(pattern, "").trim() : content, calls };
}
