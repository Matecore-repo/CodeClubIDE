import { ipcMain, app } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { rankTexts } from "../indexer/embedder";

interface MemoryFact {
  key: string;
  value: string;
  ts: string;
}

interface MemoryStore {
  facts: MemoryFact[];
  ragBlocks?: RagBlock[];
}

interface RagBlock {
  id: string;
  name: string;
  code: string;
  language: string;
  filePath: string;
  startLine: number;
  endLine: number;
  createdAt: string;
  updatedAt: string;
}

function getMemoryPath(workspacePath: string): string {
  const hash = createHash("sha256").update(workspacePath).digest("hex");
  const dir = join(app.getPath("userData"), "memory", hash);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "memory.json");
}

function loadMemory(workspacePath: string): MemoryStore {
  try {
    const raw = readFileSync(getMemoryPath(workspacePath), "utf-8");
    return JSON.parse(raw) as MemoryStore;
  } catch {
    return { facts: [] };
  }
}

function saveMemory(workspacePath: string, store: MemoryStore): void {
  writeFileSync(getMemoryPath(workspacePath), JSON.stringify(store, null, 2));
}

export function registerMemoryHandlers(): void {
  ipcMain.handle("memory:set", (_event, workspacePath: string, key: string, value: string) => {
    const store = loadMemory(workspacePath);
    const existing = store.facts.find((f) => f.key === key);
    if (existing) {
      existing.value = value;
      existing.ts = new Date().toISOString();
    } else {
      store.facts.push({ key, value, ts: new Date().toISOString() });
    }
    saveMemory(workspacePath, store);
    return true;
  });

  ipcMain.handle("memory:delete", (_event, workspacePath: string, key: string) => {
    const store = loadMemory(workspacePath);
    store.facts = store.facts.filter((f) => f.key !== key);
    saveMemory(workspacePath, store);
    return true;
  });

  ipcMain.handle("memory:list", (_event, workspacePath: string) => {
    return loadMemory(workspacePath).facts;
  });

  ipcMain.handle("rag:list", (_event, workspacePath: string) => {
    return loadMemory(workspacePath).ragBlocks ?? [];
  });

  ipcMain.handle(
    "rag:save",
    (_event, workspacePath: string, block: Omit<RagBlock, "createdAt" | "updatedAt">) => {
      const store = loadMemory(workspacePath);
      const blocks = store.ragBlocks ?? [];
      const now = new Date().toISOString();
      const existing = blocks.find((item) => item.id === block.id);
      if (existing) Object.assign(existing, block, { updatedAt: now });
      else blocks.push({ ...block, createdAt: now, updatedAt: now });
      store.ragBlocks = blocks;
      saveMemory(workspacePath, store);
      return blocks.find((item) => item.id === block.id);
    },
  );

  ipcMain.handle("rag:delete", (_event, workspacePath: string, id: string) => {
    const store = loadMemory(workspacePath);
    store.ragBlocks = (store.ragBlocks ?? []).filter((item) => item.id !== id);
    saveMemory(workspacePath, store);
    return true;
  });

  ipcMain.handle("rag:search", async (_event, workspacePath: string, query: string, topK = 3) => {
    const blocks = loadMemory(workspacePath).ragBlocks ?? [];
    if (!query.trim() || blocks.length === 0) return [];
    const ranked = await rankTexts(
      query,
      blocks.map((block) => `${block.name}\n${block.code}`),
      topK,
    );
    return ranked.flatMap(({ index, score }) =>
      blocks[index] ? [{ block: blocks[index], score }] : [],
    );
  });
}
