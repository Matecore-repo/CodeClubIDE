import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync } from "fs";
import { join } from "path";
import { createGunzip, createGzip } from "zlib";
import type { GraphData, GraphEdge, GraphNode } from "../../preload/types";
import { enrichTopographicNodes } from "../../shared/topographicIdentity";
import type { TopographicNode } from "../../shared/topographicNodes";
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

export function saveAstStore(workspacePath: string, nodes: TopographicNode[]): boolean {
  const db = openDatabase(workspacePath);
  if (!db) return false;
  const enriched = enrichTopographicNodes(nodes);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ast_files (
        path TEXT PRIMARY KEY,
        language TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        indexed_at INTEGER NOT NULL,
        scanner_version TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ast_nodes (
        id TEXT PRIMARY KEY,
        stable_key TEXT NOT NULL,
        parent_id TEXT,
        path TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        language TEXT NOT NULL,
        qualified_name TEXT,
        signature TEXT,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        bytes INTEGER NOT NULL,
        characters INTEGER NOT NULL,
        hash TEXT NOT NULL,
        content_hash TEXT,
        file_hash TEXT,
        child_count INTEGER NOT NULL,
        is_code INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ast_edges (
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        kind TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ast_nodes_path ON ast_nodes(path);
      CREATE INDEX IF NOT EXISTS idx_ast_nodes_type_name ON ast_nodes(type, name);
      CREATE INDEX IF NOT EXISTS idx_ast_edges_source ON ast_edges(source_id, kind);
      DELETE FROM ast_edges;
      DELETE FROM ast_nodes;
      DELETE FROM ast_files;
    `);

    const insertFile = db.prepare(
      "INSERT INTO ast_files (path, language, file_hash, indexed_at, scanner_version) VALUES (?, ?, ?, ?, ?)",
    );
    const insertNode = db.prepare(
      `INSERT INTO ast_nodes (
        id, stable_key, parent_id, path, type, name, language, qualified_name, signature,
        start_line, end_line, bytes, characters, hash, content_hash, file_hash, child_count, is_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertEdge = db.prepare(
      "INSERT INTO ast_edges (source_id, target_id, kind) VALUES (?, ?, ?)",
    );

    db.exec("BEGIN");
    const indexedAt = Date.now();
    for (const node of enriched) {
      if (node.type === "file") {
        insertFile.run(node.path, node.language, node.hash, indexedAt, "topographic-v1");
      }
      insertNode.run(
        node.id,
        node.stableKey ?? node.id,
        node.parentId ?? null,
        node.path,
        node.type,
        node.name,
        node.language,
        node.qualifiedName ?? null,
        node.signature ?? null,
        node.startLine,
        node.endLine,
        node.bytes,
        node.characters,
        node.hash,
        node.contentHash ?? node.hash,
        node.fileHash ?? node.hash,
        node.childCount,
        node.isCode ? 1 : 0,
      );
      if (node.parentId) insertEdge.run(node.parentId, node.id, "CONTAINS");
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

export function loadAstStore(workspacePath: string): TopographicNode[] | null {
  if (!existsSync(graphDbPath(workspacePath))) return null;
  const db = openDatabase(workspacePath);
  if (!db) return null;
  try {
    type StoredAstNodeRow = Omit<TopographicNode, "isCode"> & { isCode: number };
    const rows = db
      .prepare(
        `SELECT
          id, parent_id AS parentId, name, type, path, language,
          start_line AS startLine, end_line AS endLine, bytes, characters, hash,
          child_count AS childCount, is_code AS isCode, stable_key AS stableKey,
          qualified_name AS qualifiedName, signature, content_hash AS contentHash,
          file_hash AS fileHash
        FROM ast_nodes ORDER BY path, start_line, end_line`,
      )
      .all() as StoredAstNodeRow[];
    if (rows.length === 0) return null;
    return rows.map((row) => ({ ...row, isCode: Boolean(row.isCode) }));
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

export interface GraphStoreStats {
  graphNodes: number;
  graphEdges: number;
  symbols: number;
  symbolEdges: number;
  routes: number;
  astFiles: number;
  astNodes: number;
  astEdges: number;
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

function countTable(db: any, table: string): number {
  try {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

export function getGraphStoreStats(workspacePath: string): GraphStoreStats {
  const empty = {
    graphNodes: 0,
    graphEdges: 0,
    symbols: 0,
    symbolEdges: 0,
    routes: 0,
    astFiles: 0,
    astNodes: 0,
    astEdges: 0,
  };
  if (!existsSync(graphDbPath(workspacePath))) return empty;
  const db = openDatabase(workspacePath);
  if (!db) return empty;
  try {
    return {
      graphNodes: countTable(db, "graph_nodes"),
      graphEdges: countTable(db, "graph_edges"),
      symbols: countTable(db, "symbols"),
      symbolEdges: countTable(db, "symbol_edges"),
      routes: countTable(db, "routes"),
      astFiles: countTable(db, "ast_files"),
      astNodes: countTable(db, "ast_nodes"),
      astEdges: countTable(db, "ast_edges"),
    };
  } finally {
    db.close();
  }
}
