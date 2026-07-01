import type { TopographicNode } from "./topographicNodes";

function normalizedPath(path: string): string {
  return path.replace(/\\/g, "/");
}

function byId(nodes: TopographicNode[]): Map<string, TopographicNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function codeAncestors(node: TopographicNode, nodesById: Map<string, TopographicNode>): string[] {
  const names: string[] = [];
  let current = node.parentId ? nodesById.get(node.parentId) : undefined;
  while (current) {
    if (current.isCode && current.type !== "file" && current.type !== "workspace") {
      names.push(current.name);
    }
    current = current.parentId ? nodesById.get(current.parentId) : undefined;
  }
  return names.reverse();
}

function fileHashFor(node: TopographicNode, nodesById: Map<string, TopographicNode>): string {
  if (node.type === "file") return node.hash;
  let current = node.parentId ? nodesById.get(node.parentId) : undefined;
  while (current) {
    if (current.type === "file") return current.hash;
    current = current.parentId ? nodesById.get(current.parentId) : undefined;
  }
  return node.hash;
}

export function enrichTopographicNodes(nodes: TopographicNode[]): TopographicNode[] {
  const nodesById = byId(nodes);
  return nodes.map((node) => {
    const ancestors = codeAncestors(node, nodesById);
    const qualifiedName = node.qualifiedName ?? [...ancestors, node.name].filter(Boolean).join(".");
    const contentHash = node.contentHash ?? node.hash;
    const fileHash = node.fileHash ?? fileHashFor(node, nodesById);
    const stableKey =
      node.stableKey ??
      [
        normalizedPath(node.path),
        node.type,
        node.signature || qualifiedName || node.name,
        `${node.startLine}:${node.endLine}`,
      ].join("|");
    return { ...node, qualifiedName, contentHash, fileHash, stableKey };
  });
}

export function isComparableAstNode(node: TopographicNode): boolean {
  return node.isCode && node.type !== "workspace" && node.type !== "folder" && node.type !== "file";
}

export function comparableAstKey(node: TopographicNode): string {
  return [node.type, node.signature || node.qualifiedName || node.name].join("|");
}
