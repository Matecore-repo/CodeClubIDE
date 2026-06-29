import { describe, expect, it, vi } from "vitest";

vi.mock("../ipc/fs/graphCache", () => ({
  ensureGraphCache: vi.fn(async () => ({ nodes: [], edges: [] })),
}));

vi.mock("./graphStore", () => ({
  querySymbolStore: vi.fn(() => null),
  querySymbolEdges: vi.fn(() => [{ sourceId: "a", targetName: "TaskRunner", kind: "CALLS" }]),
  queryOutgoingSymbolEdges: vi.fn(() => []),
  queryRouteStore: vi.fn(() => [
    { kind: "electron-ipc", name: "indexing:search", filePath: "src/main/ipc.ts", line: 12 },
  ]),
}));

vi.mock("./workspaceIndex", () => ({
  loadMeta: vi.fn(() => ({
    chunks: [
      {
        id: "a",
        name: "runTask",
        kind: "function",
        filePath: "src/a.ts",
        startLine: 3,
        endLine: 8,
        code: "function runTask() {}",
      },
      {
        id: "b",
        name: "TaskRunner",
        kind: "class",
        filePath: "src/b.ts",
        startLine: 1,
        endLine: 9,
        code: "class TaskRunner {}",
      },
    ],
  })),
}));

const { queryGraph } = await import("./graphQuery");

describe("graph symbol query", () => {
  it("returns indexed symbols by name", async () => {
    const results = await queryGraph("C:/workspace", {
      scope: "symbols",
      namePattern: "task",
    });

    expect(results.map((result) => result.name)).toEqual(["runTask", "TaskRunner"]);
    expect(results[0]).toMatchObject({
      path: "src/a.ts",
      kind: "function",
      startLine: 3,
      endLine: 8,
    });
  });

  it("returns callers for a symbol relation", async () => {
    const results = await queryGraph("C:/workspace", {
      scope: "symbols",
      relation: "callers",
      namePattern: "TaskRunner",
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: "runTask",
        relation: "CALLS",
        path: "src/a.ts",
      }),
    ]);
  });

  it("returns persisted routes", async () => {
    const results = await queryGraph("C:/workspace", {
      scope: "routes",
      namePattern: "indexing",
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: "indexing:search",
        kind: "electron-ipc",
        path: "src/main/ipc.ts",
        line: 12,
      }),
    ]);
  });
});
