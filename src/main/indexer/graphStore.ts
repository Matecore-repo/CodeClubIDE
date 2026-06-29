import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync } from "fs";
import { join } from "path";
import { createGunzip, createGzip } from "zlib";
import type { GraphData, GraphEdge, GraphNode } from "../../preload/types";
import type { IndexChunk } from "./types";

function indexDir(workspacePath: string): string {
  const dir = join(workspacePath, ".codeclub", "index");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function graphDbPath(workspacePath: string): string {
  return join(indexDir(workspacePath), "codegraph.sqlite");
}

export function graphSnapshotPath(workspacePath: string): string {
  return join(indexDir(workspacePath), "codegraph.sqlite.gz");
}

function openDatabase(workspacePath: string): any | null {
  try {
    const sqlite = require("node:sqlite") as { DatabaseSync: new (path: string) => any };
    return new sqlite.DatabaseSync(graphDbPath(workspacePath));
  } catch {
    return null;
  }
}

export function saveGraphStore(workspacePath: string, graph: GraphData): boolean {
  const db = openDatabase(workspacePath);
  if (!db) return false;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        kind TEXT NOT NULL,
        size INTEGER NOT NULL,
        file_type TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS graph_edges (
        source TEXT NOT NULL,
        target TEXT NOT NULL
      );
      DELETE FROM graph_edges;
      DELETE FROM graph_nodes;
    `);

    const insertNode = db.prepare(
      "INSERT INTO graph_nodes (id, path, kind, size, file_type) VALUES (?, ?, ?, ?, ?)",
    );
    const insertEdge = db.prepare("INSERT INTO graph_edges (source, target) VALUES (?, ?)");

    db.exec("BEGIN");
    for (const node of graph.nodes) {
      insertNode.run(node.id, node.path, node.kind, node.size, node.fileType);
    }
    for (const edge of graph.edges) {
      insertEdge.run(edge.source, edge.target);
    }
    db.exec("COMMIT");
    return true;
  } catch {
    try {
      db.exec("ROLLBACK");
    } catch {}
    return false;
  } finally {
    db.close();
  }
}

export function loadGraphStore(workspacePath: string): GraphData | null {
  if (!existsSync(graphDbPath(workspacePath))) return null;
  const db = openDatabase(workspacePath);
  if (!db) return null;
  try {
    const nodes = db
      .prepare("SELECT id, path, kind, size, file_type AS fileType FROM graph_nodes")
      .all() as GraphNode[];
    const edges = db.prepare("SELECT source, target FROM graph_edges").all() as GraphEdge[];
    return { nodes, edges };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export function saveSymbolStore(workspacePath: string, chunks: IndexChunk[]): boolean {
  const db = openDatabase(workspacePath);
  if (!db) return false;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS symbol_edges (
        source_id TEXT NOT NULL,
        target_name TEXT NOT NULL,
        kind TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routes (
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        line INTEGER NOT NULL
      );
      DELETE FROM symbols;
      DELETE FROM symbol_edges;
      DELETE FROM routes;
    `);
    const insert = db.prepare(
      "INSERT INTO symbols (id, name, kind, file_path, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const insertEdge = db.prepare(
      "INSERT INTO symbol_edges (source_id, target_name, kind) VALUES (?, ?, ?)",
    );
    const insertRoute = db.prepare(
      "INSERT INTO routes (kind, name, file_path, line) VALUES (?, ?, ?, ?)",
    );
    db.exec("BEGIN");
    for (const chunk of chunks) {
      if (!chunk.name) continue;
      insert.run(
        chunk.id,
        chunk.name,
        chunk.kind ?? "symbol",
        chunk.filePath,
        chunk.startLine,
        chunk.endLine,
      );
      for (const call of chunk.outboundCalls ?? []) {
        insertEdge.run(chunk.id, call, "CALLS");
      }
      for (const route of extractRoutesFromChunk(chunk)) {
        insertRoute.run(route.kind, route.name, route.filePath, route.line);
      }
    }
    db.exec("COMMIT");
    return true;
  } catch {
    try {
      db.exec("ROLLBACK");
    } catch {}
    return false;
  } finally {
    db.close();
  }
}

export interface StoredSymbolEdge {
  sourceId: string;
  targetName: string;
  kind: string;
}

export function querySymbolEdges(workspacePath: string, targetName: string): StoredSymbolEdge[] {
  if (!existsSync(graphDbPath(workspacePath))) return [];
  const db = openDatabase(workspacePath);
  if (!db) return [];
  try {
    return db
      .prepare(
        "SELECT source_id AS sourceId, target_name AS targetName, kind FROM symbol_edges WHERE target_name = ?",
      )
      .all(targetName) as StoredSymbolEdge[];
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export function queryOutgoingSymbolEdges(
  workspacePath: string,
  sourceId: string,
): StoredSymbolEdge[] {
  if (!existsSync(graphDbPath(workspacePath))) return [];
  const db = openDatabase(workspacePath);
  if (!db) return [];
  try {
    return db
      .prepare(
        "SELECT source_id AS sourceId, target_name AS targetName, kind FROM symbol_edges WHERE source_id = ?",
      )
      .all(sourceId) as StoredSymbolEdge[];
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export function exportGraphSnapshot(workspacePath: string): Promise<string | null> {
  const source = graphDbPath(workspacePath);
  if (!existsSync(source)) return Promise.resolve(null);
  const target = graphSnapshotPath(workspacePath);
  return new Promise((resolve) => {
    const input = createReadStream(source);
    const output = createWriteStream(target);
    input
      .pipe(createGzip())
      .pipe(output)
      .on("finish", () => resolve(target))
      .on("error", () => resolve(null));
  });
}

export function importGraphSnapshot(
  workspacePath: string,
  snapshotPath = graphSnapshotPath(workspacePath),
): Promise<boolean> {
  if (!existsSync(snapshotPath)) return Promise.resolve(false);
  const target = graphDbPath(workspacePath);
  const temp = `${target}.${process.pid}.tmp`;
  return new Promise((resolve) => {
    const input = createReadStream(snapshotPath);
    const output = createWriteStream(temp);
    input
      .pipe(createGunzip())
      .pipe(output)
      .on("finish", () => {
        try {
          renameSync(temp, target);
          resolve(loadGraphStore(workspacePath) !== null);
        } catch {
          resolve(false);
        }
      })
      .on("error", () => resolve(false));
  });
}

export async function importGraphSnapshotIfMissing(workspacePath: string): Promise<boolean> {
  if (existsSync(graphDbPath(workspacePath))) return false;
  if (!existsSync(graphSnapshotPath(workspacePath))) return false;
  return importGraphSnapshot(workspacePath);
}

export interface StoredSymbol {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface StoredRoute {
  kind: string;
  name: string;
  filePath: string;
  line: number;
}

function extractRoutesFromChunk(chunk: IndexChunk): StoredRoute[] {
  const patterns = [
    { kind: "electron-ipc", regex: /ipcMain\.handle\(\s*["'`]([^"'`]+)["'`]/g },
    { kind: "electron-ipc", regex: /ipcMain\.on\(\s*["'`]([^"'`]+)["'`]/g },
    { kind: "http-route", regex: /\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g },
  ];
  const routes: StoredRoute[] = [];
  const lines = chunk.code.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(lines[lineIndex])) !== null) {
        routes.push({
          kind: pattern.kind,
          name: pattern.kind === "http-route" ? `${match[1].toUpperCase()} ${match[2]}` : match[1],
          filePath: chunk.filePath,
          line: chunk.startLine + lineIndex,
        });
      }
    }
  }
  return routes;
}

export function querySymbolStore(
  workspacePath: string,
  query: { namePattern?: string; kind?: string; limit?: number },
): StoredSymbol[] | null {
  if (!existsSync(graphDbPath(workspacePath))) return null;
  const db = openDatabase(workspacePath);
  if (!db) return null;
  try {
    let sql =
      "SELECT id, name, kind, file_path AS filePath, start_line AS startLine, end_line AS endLine FROM symbols";
    const clauses: string[] = [];
    const params: string[] = [];
    if (query.kind) {
      clauses.push("kind = ?");
      params.push(query.kind);
    }
    if (query.namePattern) {
      clauses.push("name LIKE ?");
      params.push(`%${query.namePattern}%`);
    }
    if (clauses.length > 0) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += " ORDER BY file_path, start_line LIMIT ?";
    return db.prepare(sql).all(...params, query.limit ?? 50) as StoredSymbol[];
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export function queryRouteStore(
  workspacePath: string,
  query: { namePattern?: string; kind?: string; limit?: number },
): StoredRoute[] | null {
  if (!existsSync(graphDbPath(workspacePath))) return null;
  const db = openDatabase(workspacePath);
  if (!db) return null;
  try {
    let sql = "SELECT kind, name, file_path AS filePath, line FROM routes";
    const clauses: string[] = [];
    const params: string[] = [];
    if (query.kind) {
      clauses.push("kind = ?");
      params.push(query.kind);
    }
    if (query.namePattern) {
      clauses.push("name LIKE ?");
      params.push(`%${query.namePattern}%`);
    }
    if (clauses.length > 0) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += " ORDER BY file_path, line LIMIT ?";
    return db.prepare(sql).all(...params, query.limit ?? 50) as StoredRoute[];
  } catch {
    return null;
  } finally {
    db.close();
  }
}
