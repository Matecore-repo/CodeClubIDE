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
