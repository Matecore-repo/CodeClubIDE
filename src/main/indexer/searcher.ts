import type { IndexChunk, SearchResult } from "./types";

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function search(
  queryEmb: Float32Array,
  chunks: IndexChunk[],
  allEmbeddings: Float32Array,
  embedDim: number,
  topK: number = 5,
): SearchResult[] {
  if (chunks.length === 0 || allEmbeddings.length === 0) return [];

  const scored: { idx: number; score: number }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const offset = i * embedDim;
    if (offset + embedDim > allEmbeddings.length) break;
    const chunkEmb = allEmbeddings.subarray(offset, offset + embedDim);
    const score = cosineSimilarity(queryEmb, chunkEmb);
    scored.push({ idx: i, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);

  return top.map((s) => ({
    chunk: chunks[s.idx],
    score: s.score,
  }));
}
