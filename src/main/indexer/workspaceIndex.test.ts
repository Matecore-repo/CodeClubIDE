import { describe, expect, it } from "vite-plus/test";
import { vi } from "vitest";
vi.mock("electron", () => ({ app: { isPackaged: false } }));
import { reusableEmbeddingIndexes } from "./workspaceIndex";
import type { IndexChunk } from "./types";

const chunk = (id: string, hash: string): IndexChunk => ({
  id,
  hash,
  filePath: "src/a.ts",
  startLine: 1,
  endLine: 1,
  code: id,
});

describe("incremental embedding selection", () => {
  it("reuses unchanged nodes and selects only changed/new nodes", () => {
    const result = reusableEmbeddingIndexes(
      [chunk("a", "1"), chunk("b", "1")],
      [chunk("a", "1"), chunk("b", "2"), chunk("c", "1")],
    );
    expect([...result.reusable.entries()]).toEqual([[0, 0]]);
    expect(result.changed).toEqual([1, 2]);
  });

  it("matches by stable id instead of source position", () => {
    const result = reusableEmbeddingIndexes(
      [chunk("a", "1"), chunk("b", "1")],
      [chunk("b", "1"), chunk("a", "1")],
    );
    expect([...result.reusable.entries()]).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(result.changed).toEqual([]);
  });
});
