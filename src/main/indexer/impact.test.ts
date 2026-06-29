import { describe, expect, it, vi } from "vitest";

vi.mock("../ipc/fs/graphCache", () => ({
  ensureGraphCache: vi.fn(async () => ({
    nodes: [],
    edges: [{ source: "src/caller.ts", target: "src/service.ts" }],
  })),
}));

vi.mock("./workspaceIndex", () => ({
  loadMeta: vi.fn(() => ({
    chunks: [
      {
        id: "service",
        name: "doWork",
        kind: "function",
        filePath: "src/service.ts",
        startLine: 1,
        endLine: 3,
        code: "export function doWork() {}",
      },
      {
        id: "caller",
        name: "run",
        kind: "function",
        filePath: "src/caller.ts",
        startLine: 5,
        endLine: 9,
        code: "doWork();",
      },
    ],
  })),
}));

vi.mock("./graphStore", () => ({
  querySymbolEdges: vi.fn(() => [{ sourceId: "caller", targetName: "doWork", kind: "CALLS" }]),
}));

const { analyzeImpact } = await import("./impact");

describe("symbol impact", () => {
  it("resolves a symbol to its file and reports callers", async () => {
    const result = await analyzeImpact("C:/workspace", "doWork");

    expect(result.targetKind).toBe("symbol");
    expect(result.targetFile).toBe("src/service.ts");
    expect(result.direct).toContain("src/caller.ts");
    expect(result.callers).toEqual([
      { name: "run", filePath: "src/caller.ts", startLine: 5, endLine: 9 },
    ]);
  });
});
