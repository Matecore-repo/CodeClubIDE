import type { DebugBreakpoint } from "../../../preload/types";

const key = (workspacePath: string) => `codeclub:breakpoints:${workspacePath}`;

export function loadBreakpoints(workspacePath: string): DebugBreakpoint[] {
  try {
    return JSON.parse(localStorage.getItem(key(workspacePath)) ?? "[]");
  } catch {
    return [];
  }
}

export function toggleBreakpoint(
  workspacePath: string,
  filePath: string,
  line: number,
): DebugBreakpoint[] {
  const current = loadBreakpoints(workspacePath);
  const index = current.findIndex((bp) => bp.filePath === filePath && bp.line === line);
  if (index >= 0) current.splice(index, 1);
  else current.push({ filePath, line });
  localStorage.setItem(key(workspacePath), JSON.stringify(current));
  window.dispatchEvent(new CustomEvent("codeclub:breakpoints", { detail: current }));
  return current;
}
