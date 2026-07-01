import type { TopographicDiffResult, TopographicNode } from "./topographicNodes";
import { comparableAstKey, enrichTopographicNodes, isComparableAstNode } from "./topographicIdentity";

function normalizedPath(path: string): string {
  return path.replace(/\\/g, "/");
}

function keywordsFromParts(parts: Array<string | undefined>): string[] {
  const ignored = new Set(["src", "include", "the", "and", "for", "with", "from"]);
  const keywords = new Set<string>();
  for (const part of parts) {
    for (const token of (part ?? "").split(/[^A-Za-z0-9_]+|(?=[A-Z])/)) {
      const normalized = token.trim();
      if (normalized.length < 3 || ignored.has(normalized.toLowerCase())) continue;
      keywords.add(normalized);
      if (keywords.size >= 8) return Array.from(keywords);
    }
  }
  return Array.from(keywords);
}

function nodeKeywords(node: TopographicNode, extra?: string): string[] {
  return keywordsFromParts([
    node.name,
    node.type,
    node.qualifiedName,
    node.signature,
    node.path,
    extra,
  ]);
}

function nodeContext(node: TopographicNode): Pick<TopographicDiffResult, "type" | "startLine" | "endLine" | "keywords"> {
  return {
    type: node.type,
    startLine: node.startLine,
    endLine: node.endLine,
    keywords: nodeKeywords(node),
  };
}

function comparableNodes(tree: TopographicNode[]): TopographicNode[] {
  return enrichTopographicNodes(tree)
    .filter(isComparableAstNode)
    .sort((a, b) => comparableAstKey(a).localeCompare(comparableAstKey(b)) || a.startLine - b.startLine);
}

function groupByKey(nodes: TopographicNode[]): Map<string, TopographicNode[]> {
  const groups = new Map<string, TopographicNode[]>();
  for (const node of nodes) {
    const key = comparableAstKey(node);
    const group = groups.get(key) ?? [];
    group.push(node);
    groups.set(key, group);
  }
  return groups;
}

function sameLocation(a: TopographicNode, b: TopographicNode): boolean {
  return (
    normalizedPath(a.path) === normalizedPath(b.path) &&
    a.startLine === b.startLine &&
    a.endLine === b.endLine
  );
}

function removed(node: TopographicNode): TopographicDiffResult {
  return { id: node.id, name: node.name, path: node.path, status: "removed", ...nodeContext(node) };
}

function added(node: TopographicNode): TopographicDiffResult {
  return { id: node.id, name: node.name, path: node.path, status: "added", ...nodeContext(node) };
}

export function hasComparableAstNodes(tree: TopographicNode[]): boolean {
  return comparableNodes(tree).length > 0;
}

export function diffTopographicNodeTrees(
  treeA: TopographicNode[],
  treeB: TopographicNode[],
): TopographicDiffResult[] {
  const groupsA = groupByKey(comparableNodes(treeA));
  const groupsB = groupByKey(comparableNodes(treeB));
  const keys = new Set([...groupsA.keys(), ...groupsB.keys()]);
  const diffs: TopographicDiffResult[] = [];
  const unmatchedRemoved: TopographicNode[] = [];
  const unmatchedAdded: TopographicNode[] = [];

  for (const key of keys) {
    const left = groupsA.get(key) ?? [];
    const right = groupsB.get(key) ?? [];
    const pairs = Math.min(left.length, right.length);

    for (let index = 0; index < pairs; index++) {
      const a = left[index];
      const b = right[index];
      if (a.hash !== b.hash) {
        diffs.push({
          id: b.id,
          name: b.name,
          path: b.path,
          status: "modified",
          ...nodeContext(b),
          context: {
            summary: `${b.type} ${b.name} changed at ${normalizedPath(b.path)}:${b.startLine}-${b.endLine}`,
          },
        });
      } else if (!sameLocation(a, b)) {
        diffs.push({
          id: b.id,
          name: b.name,
          path: b.path,
          status: "moved",
          ...nodeContext(b),
          previousPath: a.path,
          context: {
            summary: `${b.type} ${b.name} moved from ${normalizedPath(a.path)} to ${normalizedPath(b.path)}`,
          },
        });
      }
    }

    unmatchedRemoved.push(...left.slice(pairs));
    unmatchedAdded.push(...right.slice(pairs));
  }

  const consumedAdded = new Set<number>();
  for (const oldNode of unmatchedRemoved) {
    const renamedIndex = unmatchedAdded.findIndex(
      (newNode, index) =>
        !consumedAdded.has(index) && newNode.type === oldNode.type && newNode.hash === oldNode.hash,
    );
    if (renamedIndex >= 0) {
      const newNode = unmatchedAdded[renamedIndex];
      consumedAdded.add(renamedIndex);
      diffs.push({
        id: newNode.id,
        name: newNode.name,
        path: newNode.path,
        status: "renamed",
        ...nodeContext(newNode),
        previousName: oldNode.name,
        previousPath: oldNode.path,
        keywords: nodeKeywords(newNode, oldNode.name),
        context: {
          summary: `${oldNode.type} renamed from ${oldNode.name} to ${newNode.name}`,
        },
      });
    } else {
      diffs.push(removed(oldNode));
    }
  }

  unmatchedAdded.forEach((node, index) => {
    if (!consumedAdded.has(index)) diffs.push(added(node));
  });

  return diffs;
}
