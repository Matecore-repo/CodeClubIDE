export type StructuralNodeType =
  | "function"
  | "class"
  | "interface"
  | "rule"
  | "element"
  | "section"
  | "block"
  | "other";

export interface StructuralNode {
  id: string;
  name: string;
  type: StructuralNodeType;
  ancestors: string[];
  startLine: number;
  endLine: number;
  content: string;
  baseHash: string;
}

export function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function semanticNodeHash(source: string): string {
  return stableHash(source);
}

export function structuralNodeId(
  filePath: string,
  type: StructuralNodeType,
  name: string,
  ancestors: string[] = [],
): string {
  const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();
  return stableHash([normalizedPath, type, ...ancestors, name].join("\u001f"));
}
