import { describe, expect, it } from "vitest";
import type { TopographicNode } from "./topographicNodes";
import { diffTopographicNodeTrees, hasComparableAstNodes } from "./topographicDiff";

function node(overrides: Partial<TopographicNode>): TopographicNode {
  return {
    id: "n1",
    parentId: null,
    name: "run",
    type: "function",
    path: "src/a.ts",
    language: "ts",
    startLine: 1,
    endLine: 3,
    bytes: 10,
    characters: 10,
    hash: "h1",
    childCount: 0,
    isCode: true,
    ...overrides,
  };
}

describe("topographic AST diff", () => {
  it("detects modified comparable AST nodes", () => {
    const before = [node({ id: "a", hash: "old" })];
    const after = [node({ id: "b", hash: "new" })];

    expect(hasComparableAstNodes(before)).toBe(true);
    expect(diffTopographicNodeTrees(before, after)).toMatchObject([
      { id: "b", status: "modified", name: "run", keywords: expect.arrayContaining(["run"]) },
    ]);
  });

  it("detects renamed nodes by matching content hash", () => {
    const before = [node({ id: "a", name: "oldName", hash: "same" })];
    const after = [node({ id: "b", name: "newName", hash: "same" })];

    expect(diffTopographicNodeTrees(before, after)).toMatchObject([
      { id: "b", status: "renamed", previousName: "oldName" },
    ]);
  });
});
