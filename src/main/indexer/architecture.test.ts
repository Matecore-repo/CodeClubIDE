import { describe, expect, it, vi } from "vitest";

vi.mock("../ipc/fs/graphCache", () => ({
  ensureGraphCache: vi.fn(async () => ({
    nodes: [{ id: "src/main.ts", path: "src/main.ts", kind: "file", size: 10, fileType: "ts" }],
    edges: [],
  })),
  ensureTopographicCache: vi.fn(async () => [
    {
      id: "file",
      parentId: null,
      name: "main.ts",
      type: "file",
      path: "src/main.ts",
      language: "ts",
      startLine: 1,
      endLine: 5,
      bytes: 100,
      characters: 100,
      hash: "file-hash",
      childCount: 1,
      isCode: true,
    },
    {
      id: "main",
      parentId: "file",
      name: "main",
      type: "function",
      path: "src/main.ts",
      language: "ts",
      startLine: 1,
      endLine: 5,
      bytes: 100,
      characters: 100,
      hash: "fn-hash",
      childCount: 0,
      isCode: true,
    },
  ]),
}));

vi.mock("./graphStore", () => ({
  getGraphStoreStats: vi.fn(() => ({
    graphNodes: 1,
    graphEdges: 0,
    symbols: 1,
    symbolEdges: 0,
    routes: 1,
    astFiles: 1,
    astNodes: 2,
    astEdges: 1,
  })),
  graphDbPath: vi.fn(() => "C:/workspace/.codeclub/index/codegraph.sqlite"),
  queryRouteStore: vi.fn(() => [
    { kind: "electron-ipc", name: "fs:readFile", filePath: "src/main.ts", line: 4 },
  ]),
}));

vi.mock("./workspaceIndex", () => ({
  loadMeta: vi.fn(() => ({
    chunks: [
      {
        id: "main",
        filePath: "src/main.ts",
        startLine: 1,
        endLine: 5,
        code: "ipcMain.handle('fallback', () => {})",
      },
    ],
  })),
}));

const { getArchitectureSummary } = await import("./architecture");

describe("architecture summary", () => {
  it("uses persisted routes when available", async () => {
    const summary = await getArchitectureSummary("C:/workspace");

    expect(summary.routes).toEqual([
      { kind: "electron-ipc", name: "fs:readFile", filePath: "src/main.ts", line: 4 },
    ]);
    expect(summary.graphDbPath).toBe("C:/workspace/.codeclub/index/codegraph.sqlite");
    expect(summary.sources).toMatchObject({ astFiles: 1, astNodes: 2, routes: 1 });
    expect(summary.quality.level).toBe("partial");
    expect(summary.schema.astNodeTypes).toEqual([
      { type: "file", count: 1 },
      { type: "function", count: 1 },
    ]);
  });
});
