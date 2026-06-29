import { app } from "electron";
import { execFile, spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import type { IndexChunk, SearchResult } from "./types";

export function getScanBinaryPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, "resources", "bin", "codeclub-engine.exe");
  const developmentBinary = join(
    process.cwd(),
    "rust-engine",
    "target",
    "debug",
    "codeclub-engine.exe",
  );
  return existsSync(developmentBinary)
    ? developmentBinary
    : join(process.cwd(), "resources", "bin", "codeclub-engine.exe");
}

export async function scanWorkspace(
  workspacePath: string,
  cachePath?: string,
): Promise<IndexChunk[] | null> {
  const binaryPath = getScanBinaryPath();
  if (!existsSync(binaryPath)) return null;

  return new Promise((resolve) => {
    const args = ["scan", workspacePath];
    if (cachePath) args.push(cachePath);

    const chunks: IndexChunk[] = [];
    let buffer = "";
    let settled = false;

    const finish = (result: IndexChunk[] | null): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const parseLine = (line: string): boolean => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      try {
        chunks.push(JSON.parse(trimmed) as IndexChunk);
        return true;
      } catch (error) {
        console.warn("[indexer] Invalid Rust scanner output, using TypeScript fallback:", error);
        return false;
      }
    };

    const child = spawn(binaryPath, args, { windowsHide: true });

    child.stdout.on("data", (data: Buffer | string) => {
      if (settled) return;
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!parseLine(line)) {
          child.kill();
          finish(null);
          return;
        }
      }
    });

    child.on("error", (error) => {
      console.warn("[indexer] Rust scanner failed, using TypeScript fallback:", error);
      finish(null);
    });

    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        const error = new Error(`Rust scanner exited with code ${code ?? "unknown"}`);
        console.warn("[indexer] Rust scanner failed, using TypeScript fallback:", error);
        finish(null);
        return;
      }

      if (buffer && !parseLine(buffer)) {
        finish(null);
        return;
      }

      finish(chunks);
    });
  });
}

export async function searchHybrid(
  metaPath: string,
  embeddingsPath: string,
  query: string,
  queryVector: number[],
  topK: number,
): Promise<SearchResult[] | null> {
  const binaryPath = getScanBinaryPath();
  if (!existsSync(binaryPath)) return null;
  return new Promise((resolve) => {
    execFile(
      binaryPath,
      ["search", metaPath, embeddingsPath, query, JSON.stringify(queryVector), String(topK)],
      { maxBuffer: 50 * 1024 * 1024 },
      (error, stdout) => {
        if (error) return resolve(null);
        try {
          resolve(JSON.parse(stdout) as SearchResult[]);
        } catch {
          resolve(null);
        }
      },
    );
  });
}
