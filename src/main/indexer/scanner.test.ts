import { beforeEach, describe, expect, it } from "vite-plus/test";
import { vi } from "vitest";

const execFile = vi.fn();
const existsSync = vi.fn();
vi.mock("electron", () => ({
  app: { isPackaged: false },
}));
vi.mock("child_process", () => ({ execFile }));
vi.mock("fs", () => ({ existsSync }));

const { scanWorkspace, searchHybrid } = await import("./scanner");

describe("Rust scanner fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the engine is absent", async () => {
    existsSync.mockReturnValue(false);
    expect(await scanWorkspace("C:\\workspace")).toBeNull();
  });

  it("returns null when scan output is invalid", async () => {
    existsSync.mockReturnValue(true);
    execFile.mockImplementation((_file, _args, _options, callback) =>
      callback(null, "not-json\n", ""),
    );
    expect(await scanWorkspace("C:\\workspace")).toBeNull();
  });

  it("parses JSONL chunks", async () => {
    existsSync.mockReturnValue(true);
    execFile.mockImplementation((_file, _args, _options, callback) =>
      callback(null, '{"id":"1","filePath":"a.ts","startLine":1,"endLine":1,"code":"x"}\n', ""),
    );
    expect(await scanWorkspace("C:\\workspace")).toHaveLength(1);
  });

  it("falls back when hybrid search process fails", async () => {
    existsSync.mockReturnValue(true);
    execFile.mockImplementation((_file, _args, _options, callback) =>
      callback(new Error("failed"), "", ""),
    );
    expect(await searchHybrid("meta", "vectors", "q", [1], 3)).toBeNull();
  });
});
