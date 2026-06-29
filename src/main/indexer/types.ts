export interface IndexChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  code: string;
  kind?: string;
  name?: string;
  imports?: string[];
  outboundCalls?: string[];
  hash?: string;
  modifiedAt?: number;
}

export interface IndexMeta {
  version: number;
  workspacePath: string;
  model: string;
  embedDim: number;
  updatedAt: string;
  chunks: IndexChunk[];
}

export interface SearchResult {
  chunk: IndexChunk;
  score: number;
}

export interface IndexStatus {
  workspacePath: string;
  totalChunks: number;
  totalFiles: number;
  model: string;
  updatedAt: string | null;
  exists: boolean;
}
