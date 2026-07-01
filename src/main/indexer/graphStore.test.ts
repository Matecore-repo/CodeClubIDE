import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { gzipSync } from "zlib";
import { describe, expect, it } from "vitest";
import {
  exportGraphSnapshot,
  graphDbPath,
  graphSnapshotPath,
  importGraphSnapshot,
  loadAstStore,
  saveAstStore,
} from "./graphStore";

describe("graph snapshots", () => {
  it("exports and imports a gzip sqlite snapshot", async () => {
    const workspace = join(tmpdir(), `codeclub-graph-${process.pid}-${Date.now()}`);
    mkdirSync(join(workspace, ".codeclub", "index"), { recursive: true });
    try {
      writeFileSync(graphDbPath(workspace), "sqlite-data");
      await expect(exportGraphSnapshot(workspace)).resolves.toBe(graphSnapshotPath(workspace));
      expect(readFileSync(graphSnapshotPath(workspace)).length).toBeGreaterThan(0);

      writeFileSync(graphSnapshotPath(workspace), gzipSync("restored"));
      await expect(importGraphSnapshot(workspace)).resolves.toBe(false);
      expect(readFileSync(graphDbPath(workspace), "utf-8")).toBe("restored");
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("AST graph store", () => {
  it("persists enriched AST nodes when sqlite is available", () => {
    const workspace = join(tmpdir(), `codeclub-ast-store-${process.pid}-${Date.now()}`);
    mkdirSync(join(workspace, ".codeclub", "index"), { recursive: true });
    try {
      const saved = saveAstStore(workspace, [
        {
          id: "file",
          parentId: null,
          name: "main.ts",
          type: "file",
          path: "src/main.ts",
          language: "ts",
          startLine: 1,
          endLine: 3,
          bytes: 20,
          characters: 20,
          hash: "file-hash",
          childCount: 1,
          isCode: true,
        },
        {
          id: "fn",
          parentId: "file",
          name: "run",
          type: "function",
          path: "src/main.ts",
          language: "ts",
          startLine: 1,
          endLine: 3,
          bytes: 20,
          characters: 20,
          hash: "fn-hash",
          childCount: 0,
          isCode: true,
        },
      ]);
      if (!saved) return;

      const loaded = loadAstStore(workspace);
      expect(loaded?.find((item) => item.id === "fn")).toMatchObject({
        stableKey: "src/main.ts|function|run|1:3",
        qualifiedName: "run",
        fileHash: "file-hash",
      });
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
