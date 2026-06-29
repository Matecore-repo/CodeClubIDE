import { existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import type { IndexChunk, SearchResult, IndexStatus } from "./types";
import {
  loadMeta,
  loadEmbeddings,
  upsertChunks,
  removeChunks,
  getStatus,
  getIndexDir,
  getIndexPaths,
  initializeEmptyIndex,
  setModel,
  reusableEmbeddingIndexes,
  ensureIdeMarker,
} from "./workspaceIndex";
import { chunkFile, isIndexableFile, isExcludedDir } from "./chunker";
import { embedText, getEmbedModel, setEmbedderWorkspace, trainLocalModel } from "./embedder";
import { search as cosineSearch } from "./searcher";
import { startWatching, stopWatching } from "./watcher";
import { scanWorkspace, searchHybrid } from "./scanner";
import { initCache, onFileChanged } from "../ipc/fs/graphCache";
import { importGraphSnapshotIfMissing } from "./graphStore";

let currentWorkspace: string | null = null;
let indexQueue: string[] = [];
let indexingInProgress = false;

export function openWorkspace(workspacePath: string): void {
  try {
    if (!existsSync(workspacePath) || !statSync(workspacePath).isDirectory()) {
      console.warn(`[indexer] Workspace no longer exists: ${workspacePath}`);
      return;
    }
  } catch {
    return;
  }
  // Prevent indexing root drives which would crash the system
  if (/^[a-zA-Z]:\\$/.test(workspacePath) || workspacePath === "/") {
    console.warn(`[indexer] Refusing to index root drive: ${workspacePath}`);
    return;
  }

  if (currentWorkspace === workspacePath) return;

  if (currentWorkspace) {
    stopWatching(currentWorkspace);
  }

  currentWorkspace = workspacePath;
  setEmbedderWorkspace(workspacePath);

  importGraphSnapshotIfMissing(workspacePath)
    .catch((err) => console.error("[indexer] importGraphSnapshotIfMissing failed:", err))
    .finally(() =>
      initCache(workspacePath).catch((err) => console.error("[indexer] initCache failed:", err)),
    );

  const meta = loadMeta(workspacePath);
  ensureIdeMarker(workspacePath);
  if (!meta) {
    scheduleFullIndex(workspacePath);
  } else {
    startWatching(workspacePath, (change) => {
      handleFileChange(workspacePath, change.type, change.filePath);
    });
  }
}

export function closeWorkspace(): void {
  if (currentWorkspace) {
    stopWatching(currentWorkspace);
    currentWorkspace = null;
    setEmbedderWorkspace(null);
  }
}

export function getCurrentWorkspace(): string | null {
  return currentWorkspace;
}

async function scheduleFullIndex(workspacePath: string): Promise<void> {
  if (!existsSync(workspacePath)) return;
  indexQueue = [];
  const rustChunks = await scanWorkspace(
    workspacePath,
    join(getIndexDir(workspacePath), "scan-cache.json"),
  );

  const model = getEmbedModel();
  if (model === "local-word2vec") {
    try {
      await trainLocalModel();
    } catch (err) {
      console.error("[indexer] Failed to train local Word2Vec model:", err);
    }
  }

  if (rustChunks) {
    await indexScannedChunks(workspacePath, rustChunks);
    if (rustChunks.length === 0) initializeEmptyIndex(workspacePath, model);
    setModel(workspacePath, model);
    startWatching(workspacePath, (change) =>
      handleFileChange(workspacePath, change.type, change.filePath),
    );
  } else {
    collectFiles(workspacePath);
    processQueue(workspacePath);
  }
}

async function indexScannedChunks(workspacePath: string, chunks: IndexChunk[]): Promise<void> {
  const existing = loadMeta(workspacePath);
  const hashes = new Map(existing?.chunks.map((chunk) => [chunk.filePath, chunk.hash]) ?? []);
  const changedFiles = new Set(
    chunks
      .filter((chunk) => hashes.get(chunk.filePath) !== chunk.hash)
      .map((chunk) => chunk.filePath),
  );
  const changedChunks = chunks.filter((chunk) => changedFiles.has(chunk.filePath));
  const presentFiles = new Set(chunks.map((chunk) => chunk.filePath));

  for (const filePath of new Set(existing?.chunks.map((chunk) => chunk.filePath) ?? [])) {
    if (!presentFiles.has(filePath)) removeChunks(workspacePath, filePath);
  }
  for (let offset = 0; offset < changedChunks.length; offset += 250) {
    await indexBatch(workspacePath, [
      { filePath: "", chunks: changedChunks.slice(offset, offset + 250) },
    ]);
  }
}

async function handleFileChange(
  workspacePath: string,
  type: "upsert" | "remove",
  filePath: string,
): Promise<void> {
  onFileChanged(workspacePath, filePath);
  const relativePath = relative(workspacePath, filePath).replace(/\\/g, "/");
  if (type === "remove") {
    removeChunks(workspacePath, relativePath);
    return;
  }
  await indexSingleFile(workspacePath, filePath);
}

function collectFiles(dir: string): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = join(dir, e.name);
      try {
        if (e.isDirectory()) {
          if (!isExcludedDir(e.name)) collectFiles(fullPath);
        } else {
          if (isIndexableFile(fullPath)) {
            indexQueue.push(fullPath);
          }
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
}

async function processQueue(workspacePath: string): Promise<void> {
  if (indexingInProgress || indexQueue.length === 0) return;
  indexingInProgress = true;

  const batch: { filePath: string; chunks: IndexChunk[] }[] = [];
  const batchSize = 100;

  const slice = indexQueue.splice(0, Math.min(batchSize, indexQueue.length));
  const chunkPromises = slice.map(async (filePath) => {
    const chunks = await chunkFile(filePath, workspacePath);
    if (chunks.length > 0) return { filePath, chunks };
    return null;
  });
  const results = await Promise.all(chunkPromises);
  for (const r of results) {
    if (r) batch.push(r);
  }

  if (batch.length > 0) {
    await indexBatch(workspacePath, batch);
  }

  indexingInProgress = false;

  if (indexQueue.length > 0) {
    processQueue(workspacePath);
  } else {
    const model = getEmbedModel();
    setModel(workspacePath, model);
    startWatching(workspacePath, (change) => {
      handleFileChange(workspacePath, change.type, change.filePath);
    });
  }
}

async function indexBatch(
  workspacePath: string,
  batch: { filePath: string; chunks: IndexChunk[] }[],
): Promise<void> {
  const allCodes: string[] = [];
  const allChunks: IndexChunk[] = [];

  for (const { chunks } of batch) {
    for (const c of chunks) {
      allCodes.push(c.code);
      allChunks.push(c);
    }
  }

  if (allCodes.length === 0) return;

  const result = await embedText(allCodes);
  if (!result) return;

  const flat = new Float32Array(result.embeddings.length * result.embeddings[0].length);
  let offset = 0;
  for (const emb of result.embeddings) {
    flat.set(emb, offset);
    offset += emb.length;
  }

  upsertChunks(workspacePath, allChunks, flat);
}

async function indexSingleFile(workspacePath: string, filePath: string): Promise<void> {
  const chunks = await chunkFile(filePath, workspacePath);
  if (chunks.length === 0) {
    removeChunks(workspacePath, relative(workspacePath, filePath).replace(/\\/g, "/"));
    return;
  }

  const meta = loadMeta(workspacePath);
  const oldEmbeddings = meta ? loadEmbeddings(workspacePath, meta.embedDim) : null;
  const { reusable, changed } = reusableEmbeddingIndexes(meta?.chunks ?? [], chunks);
  if (changed.length === 0 && meta && oldEmbeddings) {
    const flat = new Float32Array(chunks.length * meta.embedDim);
    for (const [newIndex, oldIndex] of reusable) {
      flat.set(
        oldEmbeddings.subarray(oldIndex * meta.embedDim, (oldIndex + 1) * meta.embedDim),
        newIndex * meta.embedDim,
      );
    }
    upsertChunks(workspacePath, chunks, flat);
    return;
  }

  const result = await embedText(changed.map((index) => chunks[index].code));
  if (!result || result.embeddings.length === 0) return;
  const embedDim = result.embeddings[0].length;
  const flat = new Float32Array(chunks.length * embedDim);
  if (oldEmbeddings && meta?.embedDim === embedDim) {
    for (const [newIndex, oldIndex] of reusable) {
      flat.set(
        oldEmbeddings.subarray(oldIndex * embedDim, (oldIndex + 1) * embedDim),
        newIndex * embedDim,
      );
    }
  }
  changed.forEach((chunkIndex, resultIndex) =>
    flat.set(result.embeddings[resultIndex], chunkIndex * embedDim),
  );

  upsertChunks(workspacePath, chunks, flat);
}

export async function reindex(workspacePath: string, filePath?: string): Promise<void> {
  const model = getEmbedModel();
  if (model === "local-word2vec") {
    try {
      await trainLocalModel();
    } catch (err) {
      console.error("[indexer] Failed to train local Word2Vec model:", err);
    }
  }

  if (filePath) {
    await indexSingleFile(workspacePath, filePath);
  } else {
    await scheduleFullIndex(workspacePath);
  }
}

function getSignature(code: string, kind?: string): string {
  if (
    kind &&
    (kind.includes("function") ||
      kind.includes("class") ||
      kind.includes("method") ||
      kind.includes("interface"))
  ) {
    const lines = code.split("\n");
    let signature = "";
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      signature += lines[i] + "\n";
      if (lines[i].includes("{") || lines[i].includes("=>")) break;
    }
    return signature.trim() + "\n  // ... [Body omitted for Token Optimization]";
  }
  return code;
}

export async function searchIndex(
  workspacePath: string,
  query: string,
  topK: number = 5,
): Promise<SearchResult[]> {
  const meta = loadMeta(workspacePath);
  if (!meta || meta.chunks.length === 0) return [];

  const queryEmb = await embedText([query]);
  if (!queryEmb || !queryEmb.embeddings[0]) return [];

  const allEmb = loadEmbeddings(workspacePath, meta.embedDim);
  if (!allEmb) return [];

  const queryVec = new Float32Array(queryEmb.embeddings[0]);
  const paths = getIndexPaths(workspacePath);
  const rustResults = await searchHybrid(
    paths.metaPath,
    paths.embeddingsPath,
    query,
    queryEmb.embeddings[0],
    topK,
  );
  const basicResults =
    rustResults ?? cosineSearch(queryVec, meta.chunks, allEmb, meta.embedDim, topK);

  // --- Graph RAG Expansion ---
  const expandedResults = [...basicResults];
  const seenIds = new Set(basicResults.map((r) => r.chunk.id));

  for (const res of basicResults) {
    const chunk = res.chunk;

    // 1. Añadir Callee Chunks (funciones que esta llama)
    if (chunk.outboundCalls) {
      for (const callName of chunk.outboundCalls) {
        const callee = meta.chunks.find((c) => c.name === callName);
        if (callee && !seenIds.has(callee.id)) {
          const signatureChunk = { ...callee, code: getSignature(callee.code, callee.kind) };
          expandedResults.push({ chunk: signatureChunk, score: res.score * 0.9 }); // Score ligeramente menor para contexto expandido
          seenIds.add(callee.id);
        }
      }
    }

    // 2. Añadir Caller Chunks (funciones que llaman a esta)
    const callers = meta.chunks.filter((c) => c.outboundCalls?.includes(chunk.name || ""));
    for (const caller of callers) {
      if (!seenIds.has(caller.id)) {
        const signatureChunk = { ...caller, code: getSignature(caller.code, caller.kind) };
        expandedResults.push({ chunk: signatureChunk, score: res.score * 0.8 });
        seenIds.add(caller.id);
      }
    }
  }

  return expandedResults.sort((a, b) => b.score - a.score).slice(0, topK + 5);
}

export function getIndexStatus(workspacePath: string): IndexStatus {
  return getStatus(workspacePath);
}
