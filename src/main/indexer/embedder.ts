import { existsSync } from "fs";
import { join } from "path";
import { app } from "electron";
import { execFile } from "child_process";

let activeWorkspacePath: string | null = null;

export function setEmbedderWorkspace(workspacePath: string | null): void {
  activeWorkspacePath = workspacePath;
}

function getEmbedBinaryPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return join(process.cwd(), "resources", "bin", "embed.exe");
  }
  return join(process.resourcesPath, "resources", "bin", "embed.exe");
}

function getEngineBinaryPath(): string {
  const isDev = !app.isPackaged;
  return isDev
    ? join(process.cwd(), "resources", "bin", "codeclub-engine.exe")
    : join(process.resourcesPath, "resources", "bin", "codeclub-engine.exe");
}

function getActiveBinaryPath(): string | null {
  const engine = getEngineBinaryPath();
  if (existsSync(engine)) return engine;
  const legacy = getEmbedBinaryPath();
  return existsSync(legacy) ? legacy : null;
}

function getLocalModelPath(): string | null {
  if (!activeWorkspacePath) return null;
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(activeWorkspacePath).digest("hex");
  const dir = join(app.getPath("userData"), "indices", hash);
  const { mkdirSync } = require("fs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "word2vec.model");
}

export async function trainLocalModel(): Promise<void> {
  const workspacePath = activeWorkspacePath;
  if (!workspacePath) return;

  const modelPath = getLocalModelPath();
  if (!modelPath) return;

  const binaryPath = getActiveBinaryPath();
  if (!binaryPath) {
    console.error("[embedder] Rust embedding engine not found");
    return;
  }

  return new Promise((resolve, reject) => {
    execFile(binaryPath, ["train", workspacePath, modelPath, "128"], (err, stdout, stderr) => {
      if (err) {
        console.error("[embedder] Local model training failed:", err, stderr);
        reject(err);
      } else {
        console.log("[embedder] Local model trained successfully");
        resolve();
      }
    });
  });
}

export function clearConfigCache(): void {
  // No-op since we only use local embeddings
}

export function getEmbedModel(): string {
  return "local-word2vec";
}

export async function embedText(
  texts: string[],
): Promise<{ embeddings: number[][]; model: string } | null> {
  const modelPath = getLocalModelPath();
  const binaryPath = getActiveBinaryPath();

  if (!modelPath || !existsSync(modelPath) || !binaryPath) {
    console.warn("[embedder] Local model or binary missing, training local model first...");
    try {
      await trainLocalModel();
    } catch (err) {
      console.error("[embedder] Pre-embedding training failed:", err);
      return null;
    }
  }

  const updatedModelPath = getLocalModelPath();
  if (!updatedModelPath || !existsSync(updatedModelPath) || !binaryPath) {
    return null;
  }

  // Windows command line limit is 8191. We partition texts so that each child process invocation
  // stays well within limits (e.g. max 3000 chars of JSON content).
  const allEmbeddings: number[][] = [];
  let currentChunk: string[] = [];
  let currentLen = 0;
  const chunks: string[][] = [];

  for (const text of texts) {
    const textLen = JSON.stringify(text).length;
    if (currentLen + textLen > 3000 && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLen = 0;
    }
    currentChunk.push(text);
    currentLen += textLen;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  for (const chunk of chunks) {
    const inputJson = JSON.stringify(chunk);
    const chunkEmbeddings = await new Promise<number[][] | null>((resolve) => {
      execFile(
        binaryPath,
        ["embed", updatedModelPath, inputJson],
        { maxBuffer: 50 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            console.error("[embedder] Local embedding failed:", err, stderr);
            resolve(null);
            return;
          }
          try {
            const parsed = JSON.parse(stdout) as number[][];
            resolve(parsed);
          } catch (parseErr) {
            console.error("[embedder] Failed to parse local embedding output:", parseErr);
            resolve(null);
          }
        },
      );
    });

    if (!chunkEmbeddings) {
      return null;
    }
    allEmbeddings.push(...chunkEmbeddings);
  }

  return {
    embeddings: allEmbeddings,
    model: "local-word2vec",
  };
}

export async function embedSingle(text: string): Promise<number[] | null> {
  const result = await embedText([text]);
  if (!result) return null;
  return result.embeddings[0];
}

export async function rankTexts(
  query: string,
  texts: string[],
  topK: number,
): Promise<{ index: number; score: number }[]> {
  const modelPath = getLocalModelPath();
  const binaryPath = getActiveBinaryPath();
  if (!modelPath || !existsSync(modelPath) || !binaryPath) {
    try {
      await trainLocalModel();
    } catch {
      return [];
    }
  }
  const readyModelPath = getLocalModelPath();
  if (!readyModelPath || !existsSync(readyModelPath) || !binaryPath) return [];
  return new Promise((resolve) => {
    execFile(
      binaryPath,
      ["rank", readyModelPath, query, JSON.stringify(texts), String(topK)],
      { maxBuffer: 20 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return resolve([]);
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve([]);
        }
      },
    );
  });
}

export function hasEmbedConfig(): boolean {
  return true;
}
