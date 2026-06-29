import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { join } from "path";
import { app } from "electron";
import type { IndexMeta, IndexChunk, IndexStatus } from "./types";

export const INDEX_VERSION = 4;

function sha256(input: string): string {
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getIndexDir(workspacePath: string): string {
  const hash = sha256(workspacePath);
  const dir = join(app.getPath("userData"), "indices", hash);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getIdeDir(workspacePath: string): string {
  return join(workspacePath, ".codeclub");
}

export function ensureIdeMarker(workspacePath: string): void {
  const ideDir = getIdeDir(workspacePath);
  if (!existsSync(ideDir)) mkdirSync(ideDir, { recursive: true });
  const markerPath = join(ideDir, "codeclub.json");
  const marker = {
    workspaceId: sha256(workspacePath).slice(0, 16),
    version: INDEX_VERSION,
    lastIndexed: new Date().toISOString(),
  };
  writeFileSync(markerPath, JSON.stringify(marker, null, 2));
}

function getMetaPath(workspacePath: string): string {
  return join(getIndexDir(workspacePath), "meta.json");
}

function getEmbPath(workspacePath: string): string {
  return join(getIndexDir(workspacePath), "embeddings.bin");
}

export function getIndexPaths(workspacePath: string): { metaPath: string; embeddingsPath: string } {
  return { metaPath: getMetaPath(workspacePath), embeddingsPath: getEmbPath(workspacePath) };
}

export function loadMeta(workspacePath: string): IndexMeta | null {
  try {
    const raw = readFileSync(getMetaPath(workspacePath), "utf-8");
    const meta = JSON.parse(raw) as IndexMeta;
    return meta.version === INDEX_VERSION ? meta : null;
  } catch {
    return null;
  }
}

export function saveMeta(meta: IndexMeta): void {
  atomicWrite(getMetaPath(meta.workspacePath), JSON.stringify(meta, null, 2));
}

export function loadEmbeddings(workspacePath: string, _embedDim: number): Float32Array | null {
  try {
    const buf = readFileSync(getEmbPath(workspacePath));
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  } catch {
    return null;
  }
}

export function saveEmbeddings(workspacePath: string, embeddings: Float32Array): void {
  atomicWrite(getEmbPath(workspacePath), Buffer.from(embeddings.buffer));
}

function atomicWrite(path: string, data: string | Buffer): void {
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, data);
  renameSync(tempPath, path);
}

export function getStatus(workspacePath: string): IndexStatus {
  const meta = loadMeta(workspacePath);
  if (!meta) {
    return {
      workspacePath,
      totalChunks: 0,
      totalFiles: 0,
      model: "",
      updatedAt: null,
      exists: false,
    };
  }
  const files = new Set(meta.chunks.map((c) => c.filePath));
  return {
    workspacePath,
    totalChunks: meta.chunks.length,
    totalFiles: files.size,
    model: meta.model,
    updatedAt: meta.updatedAt,
    exists: true,
  };
}

export function initializeEmptyIndex(workspacePath: string, model: string): void {
  const meta: IndexMeta = {
    version: INDEX_VERSION,
    workspacePath,
    model,
    embedDim: 0,
    updatedAt: new Date().toISOString(),
    chunks: [],
  };
  saveMeta(meta);
  saveEmbeddings(workspacePath, new Float32Array());
}

export function removeChunks(workspacePath: string, filePath: string): IndexMeta | null {
  const meta = loadMeta(workspacePath);
  if (!meta) return null;
  const normalized = filePath.replace(/\\/g, "/");
  const before = meta.chunks.length;
  const removed = meta.chunks
    .map((chunk, index) => ({ chunk, index }))
    .filter(({ chunk }) => chunk.filePath === normalized);
  meta.chunks = meta.chunks.filter((c) => c.filePath !== normalized);
  if (meta.chunks.length !== before) {
    const oldEmb = loadEmbeddings(workspacePath, meta.embedDim);
    if (oldEmb) {
      const removedIndexes = new Set(removed.map(({ index }) => index));
      const kept = new Float32Array(meta.chunks.length * meta.embedDim);
      let target = 0;
      for (let index = 0; index < before; index++) {
        if (removedIndexes.has(index)) continue;
        kept.set(oldEmb.subarray(index * meta.embedDim, (index + 1) * meta.embedDim), target);
        target += meta.embedDim;
      }
      saveEmbeddings(workspacePath, kept);
    }
    meta.updatedAt = new Date().toISOString();
    saveMeta(meta);
    ensureIdeMarker(workspacePath);
  }
  return meta;
}

export function upsertChunks(
  workspacePath: string,
  newChunks: IndexChunk[],
  embeddings: Float32Array,
): void {
  let meta = loadMeta(workspacePath);
  const oldEmbedDim = meta?.embedDim ?? 0;
  const oldEmb = meta ? loadEmbeddings(workspacePath, meta.embedDim) : null;

  if (!meta) {
    meta = {
      version: INDEX_VERSION,
      workspacePath,
      model: "",
      embedDim: 1536,
      updatedAt: new Date().toISOString(),
      chunks: [],
    };
  }

  const embedDim = newChunks.length > 0 ? embeddings.length / newChunks.length : meta.embedDim;

  const filePathsToReplace = new Set(newChunks.map((c) => c.filePath));
  const oldById = new Map(meta.chunks.map((chunk, index) => [chunk.id, { chunk, index }]));
  const keptEmbeddings: number[] = [];

  if (oldEmb && meta.chunks.length > 0) {
    for (let i = 0; i < meta.chunks.length; i++) {
      const chunk = meta.chunks[i];
      if (!filePathsToReplace.has(chunk.filePath)) {
        const offset = i * meta.embedDim;
        if (offset + meta.embedDim <= oldEmb.length) {
          for (let j = 0; j < meta.embedDim; j++) {
            keptEmbeddings.push(oldEmb[offset + j]);
          }
        }
      }
    }
  }

  const retainedChunks = meta.chunks.filter((c) => !filePathsToReplace.has(c.filePath));
  meta.chunks = [...retainedChunks, ...newChunks];
  meta.updatedAt = new Date().toISOString();
  meta.embedDim = embedDim;

  const effectiveNewEmbeddings = new Float32Array(embeddings.length);
  for (let index = 0; index < newChunks.length; index++) {
    const next = newChunks[index];
    const previous = oldById.get(next.id);
    const targetOffset = index * embedDim;
    if (previous && previous.chunk.hash === next.hash && oldEmb && oldEmbedDim === embedDim) {
      const oldOffset = previous.index * embedDim;
      effectiveNewEmbeddings.set(oldEmb.subarray(oldOffset, oldOffset + embedDim), targetOffset);
    } else {
      effectiveNewEmbeddings.set(
        embeddings.subarray(targetOffset, targetOffset + embedDim),
        targetOffset,
      );
    }
  }

  const newFlat = new Float32Array(keptEmbeddings.length + effectiveNewEmbeddings.length);
  newFlat.set(keptEmbeddings, 0);
  newFlat.set(effectiveNewEmbeddings, keptEmbeddings.length);

  saveMeta(meta);
  saveEmbeddings(workspacePath, newFlat);
  ensureIdeMarker(workspacePath);
}

export function reusableEmbeddingIndexes(
  oldChunks: IndexChunk[],
  newChunks: IndexChunk[],
): { reusable: Map<number, number>; changed: number[] } {
  const oldById = new Map(oldChunks.map((chunk, index) => [chunk.id, { chunk, index }]));
  const reusable = new Map<number, number>();
  const changed: number[] = [];
  newChunks.forEach((chunk, index) => {
    const previous = oldById.get(chunk.id);
    if (previous && previous.chunk.hash === chunk.hash) reusable.set(index, previous.index);
    else changed.push(index);
  });
  return { reusable, changed };
}

export function setModel(workspacePath: string, model: string): void {
  const meta = loadMeta(workspacePath);
  if (meta) {
    meta.model = model;
    saveMeta(meta);
  }
}

export { getIndexDir };
