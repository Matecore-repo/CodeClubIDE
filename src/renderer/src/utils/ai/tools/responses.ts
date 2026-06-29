import type { Message, StreamEvent, UsageInfo } from "../types";
import type { ToolCall } from "../types";

export function toResponsesInput(msgs: Message[]): unknown[] {
  const out: unknown[] = [];
  for (const m of msgs) {
    if (m.role === "tool") {
      out.push({
        type: "function_call_output",
        call_id: m.tool_call_id,
        output: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      });
    } else if (m.role === "assistant") {
      out.push({ type: "message", role: "assistant", content: m.content ?? "" });
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          out.push({
            type: "function_call",
            call_id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          });
        }
      }
    } else {
      out.push({ type: "message", role: m.role, content: m.content ?? "" });
    }
  }
  return out;
}

export function parseResponsesSSE(
  parsed: Record<string, unknown>,
  toolCallAccum: Record<number, { id?: string; name?: string; args: string }>,
): StreamEvent[] {
  if (parsed.type === "response.output_text.delta" && parsed.delta) {
    return [{ type: "content", text: parsed.delta as string }];
  }

  if (parsed.type === "response.function_call_arguments.delta" && parsed.delta) {
    const idx = 0;
    if (!toolCallAccum[idx]) toolCallAccum[idx] = { args: "" };
    toolCallAccum[idx].args += parsed.delta as string;
    return [];
  }

  if (parsed.type === "response.completed") {
    const ru = (parsed.response as Record<string, unknown>)?.usage as
      | Record<string, number>
      | undefined;
    let usage: UsageInfo | undefined;
    if (ru) {
      usage = {
        prompt_tokens: ru.input_tokens ?? 0,
        completion_tokens: ru.output_tokens ?? 0,
        total_tokens: ru.total_tokens ?? 0,
      };
    }
    const output = (parsed.response as Record<string, unknown>)?.output as
      | Array<Record<string, unknown>>
      | undefined;
    const events: StreamEvent[] = [];
    if (output) {
      for (const item of output) {
        if (item.type === "function_call" && item.id) {
          events.push({
            type: "tool_call_done",
            call: {
              id: item.id as string,
              type: "function",
              function: {
                name: item.name as string,
                arguments: JSON.stringify(item.arguments),
              },
            } as ToolCall,
          });
        }
      }
    }
    if (output?.some((o) => o.type === "function_call")) {
      events.push({ type: "done", finish_reason: "tool_calls", usage });
    } else {
      events.push({ type: "done", finish_reason: "stop", usage });
    }
    return events;
  }

  return [];
}
