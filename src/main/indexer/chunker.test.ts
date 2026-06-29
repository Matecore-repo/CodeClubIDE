import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { chunkFile } from "./chunker";

describe("chunk call extraction", () => {
  it("extracts simple outbound calls from fallback chunks", async () => {
    const workspace = join(tmpdir(), `codeclub-chunker-${process.pid}-${Date.now()}`);
    mkdirSync(workspace, { recursive: true });
    const file = join(workspace, "sample.ts");
    try {
      writeFileSync(file, "export function run() {\n  doWork();\n  if (ok()) return;\n}\n");
      const chunks = await chunkFile(file, workspace);
      expect(chunks[0].outboundCalls).toEqual(expect.arrayContaining(["doWork", "ok"]));
      expect(chunks[0].outboundCalls).not.toContain("if");
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
