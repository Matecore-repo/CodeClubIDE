import { app } from "electron";
import { execFile } from "child_process";
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
    execFile(binaryPath, args, { maxBuffer: 100 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        console.warn("[indexer] Rust scanner failed, using TypeScript fallback:", error);
        resolve(null);
        return;
      }

      try {
        const chunks = stdout
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => JSON.parse(line) as IndexChunk);
        resolve(chunks);
      } catch (error) {
        console.warn("[indexer] Invalid Rust scanner output, using TypeScript fallback:", error);
        resolve(null);
      }
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
