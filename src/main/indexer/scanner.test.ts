import { EventEmitter } from "events";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { vi } from "vitest";

const execFile = vi.fn();
const spawn = vi.fn();
const existsSync = vi.fn();
vi.mock("electron", () => ({
  app: { isPackaged: false },
}));
vi.mock("child_process", () => ({ execFile, spawn }));
vi.mock("fs", () => ({ existsSync }));

const { scanWorkspace, searchHybrid } = await import("./scanner");

function mockSpawn(stdoutChunks: string[], exitCode = 0): void {
  spawn.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = new EventEmitter();
    child.kill = vi.fn(() => true);

    queueMicrotask(() => {
      for (const chunk of stdoutChunks) child.stdout.emit("data", chunk);
      child.emit("close", exitCode);
    });

    return child;
  });
}

describe("Rust scanner fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the engine is absent", async () => {
    existsSync.mockReturnValue(false);
    expect(await scanWorkspace("C:\\workspace")).toBeNull();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("returns null when scan output is invalid", async () => {
    existsSync.mockReturnValue(true);
    mockSpawn(["not-json\n"]);
    expect(await scanWorkspace("C:\\workspace")).toBeNull();
  });

  it("parses JSONL chunks", async () => {
    existsSync.mockReturnValue(true);
    mockSpawn(['{"id":"1","filePath":"a.ts","startLine":1,"endLine":1,"code":"x"}\n']);
    expect(await scanWorkspace("C:\\workspace")).toHaveLength(1);
  });

  it("returns null when the scan process exits unsuccessfully", async () => {
    existsSync.mockReturnValue(true);
    mockSpawn([], 1);
    expect(await scanWorkspace("C:\\workspace")).toBeNull();
  });

  it("parses JSONL chunks split across stdout events", async () => {
    existsSync.mockReturnValue(true);
    mockSpawn([
      '{"id":"1","filePath":"a.ts",',
      '"startLine":1,"endLine":1,"code":"x"}\n',
      '{"id":"2","filePath":"b.ts","startLine":2,"endLine":2,"code":"y"}',
    ]);
    expect(await scanWorkspace("C:\\workspace")).toHaveLength(2);
  });

  it("falls back when hybrid search process fails", async () => {
    existsSync.mockReturnValue(true);
    execFile.mockImplementation((_file, _args, _options, callback) =>
      callback(new Error("failed"), "", ""),
    );
    expect(await searchHybrid("meta", "vectors", "q", [1], 3)).toBeNull();
  });
});
