import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "../registry";
import "./index";

const workspacePath = "C:/workspace";

describe("search rust tool", () => {
  beforeEach(() => {
    (globalThis as any).window = {
      api: {
        topographicTree: vi.fn(async () => [
          {
            id: "file",
            parentId: null,
            name: "SceneWoW.h",
            type: "file",
            path: "C:/workspace/OpenWow/SceneWoW.h",
            language: "h",
            startLine: 1,
            endLine: 60,
            bytes: 100,
            characters: 100,
            hash: "file",
            childCount: 1,
            isCode: true,
          },
          {
            id: "method",
            parentId: "file",
            name: "SetMainMenu",
            type: "method",
            path: "C:/workspace/OpenWow/SceneWoW.h",
            language: "h",
            startLine: 20,
            endLine: 20,
            bytes: 10,
            characters: 10,
            hash: "method",
            childCount: 0,
            isCode: true,
          },
        ]),
        grep: vi.fn(async () => []),
      },
    };
  });

  it("prefers AST node names before content fallback", async () => {
    const result = await getTool("search")!.execute(
      { subtool: "rust", query: "SetMainMenu" },
      workspacePath,
    );
    const parsed = JSON.parse(result);

    expect(parsed.mode).toBe("ast");
    expect(parsed.warnings).toEqual([]);
    expect(parsed.results).toMatchObject([{ id: "method", matchKind: "name", type: "method" }]);
    expect((window.api.grep as any).mock.calls).toHaveLength(0);
  });

  it("does not text-fallback for unknown AST node types", async () => {
    window.api.topographicTree = vi.fn(async () => [
      {
        id: "function",
        parentId: "file",
        name: "SetMainMenu",
        type: "function",
        path: "C:/workspace/OpenWow/SceneWoW.h",
        language: "h",
        startLine: 20,
        endLine: 42,
        bytes: 10,
        characters: 10,
        hash: "function",
        childCount: 0,
        isCode: true,
      },
    ]) as any;

    const result = await getTool("search")!.execute(
      { subtool: "rust", query: "SetMainMenu", nodeType: "method" },
      workspacePath,
    );
    const parsed = JSON.parse(result);

    expect(parsed.mode).toBe("ast");
    expect(parsed.warnings).toEqual(["invalid-node-type"]);
    expect(parsed.availableNodeTypes).toContain("function");
    expect(parsed.results).toEqual([]);
    expect((window.api.grep as any).mock.calls).toHaveLength(0);
  });
});
