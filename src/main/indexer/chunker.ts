import { readFileSync } from "fs";
import { extname, relative } from "path";
import type { IndexChunk } from "./types";
import { semanticNodeHash, structuralNodeId } from "../../shared/structuralNodes";

const SCOPE_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".md",
  ".json",
  ".py",
  ".rs",
  ".go",
  ".html",
  ".yaml",
  ".yml",
  ".toml",
  ".cpp",
  ".c",
  ".sh",
  ".bash",
]);
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "out",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".next",
  ".nuxt",
]);

export function isIndexableFile(filePath: string): boolean {
  return SCOPE_EXTS.has(extname(filePath).toLowerCase());
}

export function isExcludedDir(name: string): boolean {
  return name.startsWith(".") || EXCLUDE_DIRS.has(name);
}

function extractImports(content: string, ext: string): string[] {
  if (ext === ".css") return [];
  const imports: string[] = [];
  const importRegex =
    /(?:import\s+[\s\S]*?from\s+["'`]|import\s+["'`]|require\(["'`])([^"'`]+)["'`]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) imports.push(match[1]);
  return Array.from(new Set(imports));
}

function createChunk(
  relPath: string,
  startLine: number,
  endLine: number,
  code: string,
  kind = "section",
  name?: string,
  imports?: string[],
): IndexChunk {
  return {
    id: structuralNodeId(
      relPath,
      kind === "block" ? "block" : "section",
      name ?? `block-${startLine}:${endLine}`,
    ),
    filePath: relPath,
    startLine,
    endLine,
    code,
    kind,
    name,
    imports: imports && imports.length > 0 ? imports : undefined,
    hash: semanticNodeHash(code),
  };
}

export async function chunkFile(filePath: string, workspaceRoot: string): Promise<IndexChunk[]> {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }
  if (!content.trim()) return [];

  const relPath = relative(workspaceRoot, filePath).replace(/\\/g, "/");
  const ext = extname(filePath).toLowerCase();
  const lines = content.split("\n");
  const imports = extractImports(content, ext);
  const sectionChunks = chunkNamedSections(lines, relPath, ext, imports);
  return sectionChunks.length > 0 ? sectionChunks : chunkBlocks(lines, relPath, imports);
}

function chunkNamedSections(
  lines: string[],
  relPath: string,
  ext: string,
  imports: string[],
): IndexChunk[] {
  const chunks: IndexChunk[] = [];
  if (ext === ".md") {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
      if (!match) continue;
      const end = findNext(lines, i + 1, /^#{1,6}\s+/);
      const code = lines.slice(i, end + 1).join("\n");
      chunks.push(
        createChunk(
          relPath,
          i + 1,
          end + 1,
          code,
          "section",
          match[2].trim().slice(0, 40),
          imports,
        ),
      );
    }
  } else if ([".json", ".yaml", ".yml", ".toml"].includes(ext)) {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^["']?([A-Za-z0-9_.-]+)["']?\s*[:=]/);
      if (!match) continue;
      const end = findNext(lines, i + 1, /^["']?([A-Za-z0-9_.-]+)["']?\s*[:=]/);
      const code = lines.slice(i, end + 1).join("\n");
      chunks.push(createChunk(relPath, i + 1, end + 1, code, "section", match[1], imports));
    }
  }
  return chunks;
}

function findNext(lines: string[], start: number, pattern: RegExp): number {
  for (let i = start; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i - 1;
  }
  return lines.length - 1;
}

function chunkBlocks(lines: string[], relPath: string, imports: string[]): IndexChunk[] {
  const chunks: IndexChunk[] = [];
  const blockSize = 50;
  const overlap = 10;
  for (let start = 0; start < lines.length; ) {
    const end = Math.min(start + blockSize, lines.length);
    const code = lines.slice(start, end).join("\n");
    if (code.trim())
      chunks.push(createChunk(relPath, start + 1, end, code, "block", undefined, imports));
    if (end >= lines.length) break;
    start += blockSize - overlap;
  }
  return chunks;
}
