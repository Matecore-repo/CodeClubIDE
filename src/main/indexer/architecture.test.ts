import { describe, expect, it, vi } from "vitest";

vi.mock("../ipc/fs/graphCache", () => ({
  ensureGraphCache: vi.fn(async () => ({
    nodes: [{ id: "src/main.ts", path: "src/main.ts", kind: "file", size: 10, fileType: "ts" }],
    edges: [],
  })),
}));

vi.mock("./graphStore", () => ({
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
  });
});
