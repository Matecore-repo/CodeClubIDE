import { ipcMain, shell, app, Notification, BrowserWindow, dialog, clipboard } from "electron";
import {
  appendFileSync,
  readFileSync as readFileContent,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from "fs";
import { createHash, randomUUID } from "crypto";
import { join, resolve } from "path";
import { hostname, userInfo } from "os";
import type { DesignManifest, DesignPage } from "../../shared/design";
import { lintDesignPage } from "../../shared/designLint";
import { normalizeDesignImportPage } from "../../shared/designImportValidation";
import { getDesignLayerDescendantIds } from "../../shared/designLayers";
import { syncComponentToInstances } from "../../shared/designComponents";
import { buildDesignExportFiles } from "../../shared/designExport";
import { resolveDesignTokens } from "../../shared/designTokens";
import { EMPTY_TOKENS, type DesignTokenCollection } from "../../shared/design";

const designPageCache = new Map<string, DesignPage>();
const DESIGN_CACHE_LIMIT = 32;

function designPaths(workspacePath: string) {
  const root = join(workspacePath, ".codeclub", "design");
  return {
    root,
    pages: join(root, "pages"),
    manifest: join(root, "manifest.json"),
    tokens: join(root, "tokens.json"),
  };
}

function writeJsonAtomic(path: string, value: unknown) {
  const temp = `${path}.${process.pid}.tmp`;
  const backup = `${path}.${process.pid}.bak`;
  writeFileSync(temp, JSON.stringify(value), "utf-8");
  try {
    if (existsSync(path)) renameSync(path, backup);
    renameSync(temp, path);
    if (existsSync(backup)) rmSync(backup, { force: true });
  } catch (error) {
    if (!existsSync(path) && existsSync(backup)) renameSync(backup, path);
    if (existsSync(temp)) rmSync(temp, { force: true });
    throw error;
  }
}

function readDesignManifest(workspacePath: string): DesignManifest {
  const paths = designPaths(workspacePath);
  mkdirSync(paths.pages, { recursive: true });
  if (!existsSync(paths.manifest)) {
    const manifest: DesignManifest = { version: 1, activePageId: null, pages: [] };
    writeJsonAtomic(paths.manifest, manifest);
    return manifest;
  }
  return JSON.parse(readFileContent(paths.manifest, "utf-8")) as DesignManifest;
}

function cacheDesignPage(key: string, page: DesignPage) {
  designPageCache.delete(key);
  designPageCache.set(key, page);
  if (designPageCache.size > DESIGN_CACHE_LIMIT) {
    const oldest = designPageCache.keys().next().value;
    if (oldest) designPageCache.delete(oldest);
  }
}

function readDesignPage(workspacePath: string, pageId: string): DesignPage | null {
  const key = `${workspacePath}\0${pageId}`;
  const cached = designPageCache.get(key);
  if (cached) {
    cacheDesignPage(key, cached);
    return cached;
  }
  const path = join(designPaths(workspacePath).pages, `${pageId}.json`);
  if (!existsSync(path)) return null;
  const page = JSON.parse(readFileContent(path, "utf-8")) as DesignPage;
  const tokens = readDesignTokens(workspacePath);
  page.layers = resolveDesignTokens(page.layers, tokens);
  cacheDesignPage(key, page);
  return page;
}

function writeDesignPage(workspacePath: string, page: DesignPage) {
  const paths = designPaths(workspacePath);
  mkdirSync(paths.pages, { recursive: true });
  writeJsonAtomic(join(paths.pages, `${page.id}.json`), page);
  cacheDesignPage(`${workspacePath}\0${page.id}`, page);
}

function readDesignTokens(workspacePath: string): DesignTokenCollection {
  try {
    const path = designPaths(workspacePath).tokens;
    if (existsSync(path))
      return JSON.parse(readFileContent(path, "utf-8")) as DesignTokenCollection;
  } catch {}
  return {
    ...EMPTY_TOKENS,
    colors: {},
    spacing: {},
    radii: {},
    shadows: {},
    typography: {},
    gradients: {},
  };
}

function writeDesignTokens(workspacePath: string, tokens: DesignTokenCollection) {
  writeJsonAtomic(designPaths(workspacePath).tokens, tokens);
}

function upsertDesignPage(
  workspacePath: string,
  page: DesignPage,
): { manifest: DesignManifest; page: DesignPage } {
  writeDesignPage(workspacePath, page);
  const manifest = readDesignManifest(workspacePath);
  const summary = manifest.pages.find((item) => item.id === page.id);
  if (summary) {
    summary.name = page.name;
    summary.updatedAt = Date.now();
    summary.layerCount = page.layers.length;
  } else {
    manifest.pages.push({
      id: page.id,
      name: page.name,
      updatedAt: Date.now(),
      layerCount: page.layers.length,
    });
  }
  manifest.activePageId = page.id;
  writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
  return { manifest, page };
}

function figmaNodeType(type: string): DesignPage["layers"][number]["type"] | null {
  if (type === "FRAME" || type === "COMPONENT" || type === "INSTANCE") return "frame";
  if (type === "GROUP") return "group";
  if (type === "RECTANGLE") return "rectangle";
  if (type === "ELLIPSE") return "ellipse";
  if (type === "TEXT") return "text";
  return null;
}

function convertFigmaToDesignPage(figmaFile: any): DesignPage {
  const canvas = figmaFile?.document?.children?.[0];
  if (!canvas) throw new Error("El archivo de Figma no tiene paginas.");

  const layers: DesignPage["layers"] = [];

  function mapFigmaGradientHandles(handles: any[]): number[] | undefined {
    if (!Array.isArray(handles) || handles.length < 2) return undefined;
    const h0 = handles[0];
    const h1 = handles[1];
    const hx1 = typeof h0?.x === "number" ? h0.x : 0;
    const hy1 = typeof h0?.y === "number" ? h0.y : 0;
    const hx2 = typeof h1?.x === "number" ? h1.x : 1;
    const hy2 = typeof h1?.y === "number" ? h1.y : 0;
    const dx = hx2 - hx1;
    const dy = hy2 - hy1;
    const t = [dx, -dy, hx1, dy, dx, hy1];
    return t.every((v) => Number.isFinite(v)) ? t : undefined;
  }

  function mapFigmaFills(fills: any[]): { fillsArr?: any[]; fillHex: string } {
    if (!Array.isArray(fills)) return { fillHex: "#d9d9d9" };
    const mapped: any[] = [];
    for (const item of fills) {
      if (item?.visible === false) continue;
      if (item?.type === "SOLID") {
        const c = item.color;
        const hex = c
          ? `#${Math.round((c.r ?? 0) * 255)
              .toString(16)
              .padStart(2, "0")}${Math.round((c.g ?? 0) * 255)
              .toString(16)
              .padStart(2, "0")}${Math.round((c.b ?? 0) * 255)
              .toString(16)
              .padStart(2, "0")}`
          : null;
        mapped.push({
          type: "solid",
          color: hex ?? "#d9d9d9",
          opacity: typeof item.opacity === "number" ? item.opacity : (c?.a ?? 1),
          visible: true,
        });
      } else if (item?.type === "GRADIENT_LINEAR" || item?.type === "GRADIENT_RADIAL") {
        const stops = (item.gradientStops ?? [])
          .filter((s: any) => s?.color)
          .map((s: any) => {
            const sc = s.color;
            const hex = sc
              ? `#${Math.round((sc.r ?? 0) * 255)
                  .toString(16)
                  .padStart(2, "0")}${Math.round((sc.g ?? 0) * 255)
                  .toString(16)
                  .padStart(2, "0")}${Math.round((sc.b ?? 0) * 255)
                  .toString(16)
                  .padStart(2, "0")}`
              : "#d9d9d9";
            return {
              color: hex,
              position: typeof s.position === "number" ? s.position : 0,
              opacity: sc?.a,
            };
          });
        if (stops.length) {
          mapped.push({
            type: item.type === "GRADIENT_RADIAL" ? "radial-gradient" : "linear-gradient",
            stops,
            transform: mapFigmaGradientHandles(item.gradientHandlePositions),
            opacity: typeof item.opacity === "number" ? item.opacity : 1,
            visible: true,
          });
        }
      }
    }
    const firstSolid = mapped.find((f: any) => f?.type === "solid" && f?.color);
    return {
      fillsArr: mapped.length ? mapped : undefined,
      fillHex: (firstSolid as any)?.color ?? "#d9d9d9",
    };
  }

  const walk = (node: any, parentId: string | null) => {
    const type = figmaNodeType(node?.type);
    let nextParent = parentId;

    if (type && node?.absoluteBoundingBox) {
      const layerId = `figma-${String(node.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      const box = node.absoluteBoundingBox;
      const { fillsArr, fillHex } = mapFigmaFills(node.fills);
      layers.push({
        id: layerId,
        name: node.name || type,
        type,
        parentId,
        visible: node.visible !== false,
        locked: Boolean(node.locked),
        x: Number(box.x) || 0,
        y: Number(box.y) || 0,
        width: Number(box.width) || 0,
        height: Number(box.height) || 0,
        fill: fillHex,
        fills: fillsArr,
        text: type === "text" ? node.characters || "" : undefined,
      });
      nextParent = layerId;
    }

    for (const child of node?.children ?? []) walk(child, nextParent);
  };

  for (const child of canvas.children ?? []) walk(child, null);
  if (!layers.length) throw new Error("No se encontraron nodos importables en Figma.");

  return {
    version: 1,
    id: randomUUID(),
    name: `Figma - ${canvas.name || "Page"}`,
    layers,
  };
}

function getStorePath(name: string): string {
  const dir = join(app.getPath("userData"), "stores");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `${name}.json`);
}

function readStore(name: string): Record<string, unknown> {
  try {
    const raw = readFileContent(getStorePath(name), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeStore(name: string, data: Record<string, unknown>): void {
  writeFileSync(getStorePath(name), JSON.stringify(data, null, 2));
}

function usageDir(): string {
  const dir = join(app.getPath("userData"), "usage");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function usageWorkspaceId(workspacePath?: string | null): string {
  return workspacePath
    ? createHash("sha1").update(workspacePath).digest("hex").slice(0, 16)
    : "home";
}

function logUsageEvent(stats: Record<string, unknown>): void {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const day = now.toISOString().slice(0, 10);
  const dir = usageDir();
  const workspacePath = typeof stats.workspacePath === "string" ? stats.workspacePath : null;
  const workspaceId = usageWorkspaceId(workspacePath);
  const event = { ts: now.toISOString(), workspaceId, ...stats };
  appendFileSync(join(dir, `${month}.jsonl`), JSON.stringify(event) + "\n");

  const indexPath = join(dir, "daily-index.json");
  let index: Record<string, any> = {};
  try {
    index = JSON.parse(readFileContent(indexPath, "utf-8"));
  } catch {}
  const key = `${day}:${workspaceId}`;
  const row = index[key] ?? { day, workspaceId, workspacePath, opens: 0, messages: 0, tokens: 0 };
  if (stats.type === "workspace_open") row.opens += 1;
  if (stats.type === "message_sent") row.messages += 1;
  if (typeof stats.totalTokens === "number") row.tokens += stats.totalTokens;
  index[key] = row;
  writeFileSync(indexPath, JSON.stringify(index));
}

function getUsageSummary(
  workspacePath?: string | null,
  days = 90,
): { day: string; opens: number; messages: number }[] {
  const indexPath = join(usageDir(), "daily-index.json");
  let index: Record<string, any> = {};
  try {
    index = JSON.parse(readFileContent(indexPath, "utf-8"));
  } catch {}
  const workspaceId = usageWorkspaceId(workspacePath);
  const today = new Date();
  return Array.from({ length: days }).map((_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - offset));
    const day = date.toISOString().slice(0, 10);
    const row = index[`${day}:${workspaceId}`];
    return { day, opens: row?.opens ?? 0, messages: row?.messages ?? 0 };
  });
}

function getUsageOverview(): {
  usage: { day: string; opens: number; messages: number }[];
  totalMessages: number;
  recentWorkspaces: { workspacePath: string; lastOpenedAt: string }[];
} {
  const indexPath = join(usageDir(), "daily-index.json");
  let index: Record<string, any> = {};
  try {
    index = JSON.parse(readFileContent(indexPath, "utf-8"));
  } catch {}
  const today = new Date();
  const usage = Array.from({ length: 90 }).map((_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (89 - offset));
    const day = date.toISOString().slice(0, 10);
    let opens = 0;
    let messages = 0;
    for (const row of Object.values(index)) {
      if (row?.day !== day || row?.workspaceId === "home") continue;
      opens += row.opens ?? 0;
      messages += row.messages ?? 0;
    }
    return { day, opens, messages };
  });
  const totalMessages = Object.values(index).reduce((sum, row) => {
    if (row?.workspaceId === "home") return sum;
    return sum + (row?.messages ?? 0);
  }, 0);

  const latest = new Map<string, { workspacePath: string; lastOpenedAt: string }>();
  for (const row of Object.values(index)) {
    if (!row?.workspacePath || row?.workspaceId === "home" || !row?.opens) continue;
    const current = latest.get(row.workspaceId);
    if (!current || row.day > current.lastOpenedAt) {
      latest.set(row.workspaceId, { workspacePath: row.workspacePath, lastOpenedAt: row.day });
    }
  }
  const recentWorkspaces = Array.from(latest.values())
    .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
    .slice(0, 3);

  return { usage, totalMessages, recentWorkspaces };
}

export function registerSystemHandlers(): void {
  ipcMain.handle("store:get", (_event, name: string, key: string) => {
    const store = readStore(name);
    return store[key] ?? null;
  });

  ipcMain.handle("store:set", (_event, name: string, key: string, value: unknown) => {
    const store = readStore(name);
    store[key] = value;
    writeStore(name, store);
  });

  ipcMain.handle("system:openLink", (_event, url: string) => {
    return shell.openExternal(url);
  });

  ipcMain.handle("system:openEmail", (_event, email: string) => {
    const cleanEmail = email.trim();
    clipboard.writeText(cleanEmail);
    const subject = encodeURIComponent("codeclub Enterprise License");
    const body = encodeURIComponent(
      "Hello, I would like to request information about a codeclub enterprise license.",
    );
    return shell.openExternal(`mailto:${cleanEmail}?subject=${subject}&body=${body}`);
  });

  ipcMain.handle("system:notification", (_event, title: string, body: string) => {
    new Notification({ title, body }).show();
  });

  ipcMain.handle("system:fetch", async (_event, url: string, options?: any) => {
    try {
      const res = await fetch(url, options);
      const data = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        data,
        headers: Object.fromEntries((res.headers as any).entries()),
      };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("system:fetchStream", (event, url: string, options?: any) => {
    const streamId = Math.random().toString(36).slice(2);
    const win = BrowserWindow.fromWebContents(event.sender);

    fetch(url, options)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.text();
          console.error(`[Main IPC] Error response for ${streamId}:`, err);
          win?.webContents.send(`stream:error:${streamId}`, `HTTP ${res.status}: ${err}`);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          console.error(`[Main IPC] No reader for ${streamId}`);
          win?.webContents.send(`stream:error:${streamId}`, "No reader available on response body");
          return;
        }

        try {
          let chunkCount = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (chunkCount === 0) {
                win?.webContents.send(
                  `stream:error:${streamId}`,
                  "Server closed connection without sending any data. Check model availability or API key permissions.",
                );
              } else {
                win?.webContents.send(`stream:done:${streamId}`);
              }
              break;
            }
            chunkCount++;
            const text = Buffer.from(value).toString();
            win?.webContents.send(`stream:data:${streamId}`, text);
          }
        } catch (err: any) {
          console.error(`[Main IPC] Stream ${streamId} read error:`, err);
          win?.webContents.send(`stream:error:${streamId}`, err.message);
        }
      })
      .catch((err: any) => {
        console.error(`[Main IPC] Fetch error for ${streamId}:`, err);
        win?.webContents.send(`stream:error:${streamId}`, err.message);
      });

    return streamId;
  });

  ipcMain.handle("dialog:selectFolder", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("dialog:selectFiles", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return [];
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      title: "Select files to import",
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("app:version", () => {
    return app.getVersion();
  });

  ipcMain.handle("window:minimize", () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  ipcMain.handle("window:maximize", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });

  ipcMain.handle("window:close", () => {
    BrowserWindow.getFocusedWindow()?.close();
  });

  ipcMain.handle("window:isMaximized", () => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false;
  });

  ipcMain.handle("system:logStats", (_event, stats: Record<string, unknown>) => {
    try {
      logUsageEvent(stats);
    } catch {}
  });

  ipcMain.handle(
    "system:getUsageSummary",
    (_event, workspacePath?: string | null, days?: number) => {
      try {
        return getUsageSummary(workspacePath, days ?? 90);
      } catch {
        return [];
      }
    },
  );

  ipcMain.handle("system:getUsageOverview", () => {
    try {
      return getUsageOverview();
    } catch {
      return { usage: [], totalMessages: 0, recentWorkspaces: [] };
    }
  });

  ipcMain.handle("system:getDeviceName", () => {
    try {
      return userInfo().username || hostname() || "Guest";
    } catch {
      return hostname() || "Guest";
    }
  });

  ipcMain.handle("system:readStudioConfig", (_event, workspacePath: string) => {
    try {
      if (!workspacePath) return null;
      const configPath = join(workspacePath, ".codeclub", "studio.json");
      if (existsSync(configPath)) {
        return JSON.parse(readFileContent(configPath, "utf-8"));
      }
    } catch {}
    return null;
  });

  ipcMain.handle("system:writeStudioConfig", (_event, workspacePath: string, config: any) => {
    try {
      if (!workspacePath) return;
      const dir = join(workspacePath, ".codeclub");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "studio.json"), JSON.stringify(config, null, 2));
    } catch {}
  });

  ipcMain.handle("system:designRead", (_event, workspacePath: string) => {
    const manifest = readDesignManifest(workspacePath);
    const page = manifest.activePageId
      ? readDesignPage(workspacePath, manifest.activePageId)
      : null;
    return { manifest, page };
  });

  ipcMain.handle("system:designCreatePage", (_event, workspacePath: string) => {
    const manifest = readDesignManifest(workspacePath);
    const id = randomUUID();
    const page: DesignPage = {
      version: 1,
      id,
      name: `Page ${manifest.pages.length + 1}`,
      layers: [],
    };
    manifest.pages.push({ id, name: page.name, updatedAt: Date.now(), layerCount: 0 });
    manifest.activePageId = id;
    writeDesignPage(workspacePath, page);
    writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
    return { manifest, page };
  });

  ipcMain.handle("system:designCreateLayer", (_event, workspacePath: string, pageId: string) => {
    const page = readDesignPage(workspacePath, pageId);
    if (!page) return null;
    page.layers.push({
      id: randomUUID(),
      name: `Layer ${page.layers.length + 1}`,
      type: "group",
      parentId: null,
      visible: true,
      locked: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      fill: "transparent",
    });
    writeDesignPage(workspacePath, page);
    const manifest = readDesignManifest(workspacePath);
    const summary = manifest.pages.find((item) => item.id === pageId);
    if (summary) {
      summary.updatedAt = Date.now();
      summary.layerCount = page.layers.length;
    }
    writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
    return { manifest, page };
  });

  ipcMain.handle("system:designSelectPage", (_event, workspacePath: string, pageId: string) => {
    const manifest = readDesignManifest(workspacePath);
    if (!manifest.pages.some((page) => page.id === pageId)) return null;
    manifest.activePageId = pageId;
    writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
    return readDesignPage(workspacePath, pageId);
  });

  ipcMain.handle(
    "system:designPageAction",
    (_event, workspacePath: string, pageId: string, action: string, name?: string) => {
      const manifest = readDesignManifest(workspacePath);
      const index = manifest.pages.findIndex((item) => item.id === pageId);
      if (index < 0) return null;
      const current = readDesignPage(workspacePath, pageId);
      if (!current) return null;

      if (action === "rename" && name?.trim()) {
        current.name = name.trim();
        manifest.pages[index].name = current.name;
        manifest.pages[index].updatedAt = Date.now();
        writeDesignPage(workspacePath, current);
      } else if (action === "duplicate") {
        const id = randomUUID();
        const ids = new Map(current.layers.map((layer) => [layer.id, randomUUID()]));
        const page: DesignPage = {
          ...current,
          id,
          name: `${current.name} Copy`,
          layers: current.layers.map((layer) => ({
            ...layer,
            id: ids.get(layer.id)!,
            parentId: layer.parentId ? ids.get(layer.parentId) || null : null,
            componentId:
              layer.componentId && ids.has(layer.componentId)
                ? ids.get(layer.componentId)!
                : layer.componentId,
            instanceOf:
              layer.instanceOf && ids.has(layer.instanceOf)
                ? ids.get(layer.instanceOf)!
                : layer.instanceOf,
          })),
        };
        manifest.pages.splice(index + 1, 0, {
          id,
          name: page.name,
          updatedAt: Date.now(),
          layerCount: page.layers.length,
        });
        manifest.activePageId = id;
        writeDesignPage(workspacePath, page);
      } else if (action === "delete") {
        rmSync(join(designPaths(workspacePath).pages, `${pageId}.json`), { force: true });
        designPageCache.delete(`${workspacePath}\0${pageId}`);
        manifest.pages.splice(index, 1);
        if (manifest.activePageId === pageId) {
          manifest.activePageId =
            manifest.pages[Math.min(index, manifest.pages.length - 1)]?.id ?? null;
        }
      }
      writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
      return {
        manifest,
        page: manifest.activePageId ? readDesignPage(workspacePath, manifest.activePageId) : null,
      };
    },
  );

  ipcMain.handle(
    "system:designLayerAction",
    (
      _event,
      workspacePath: string,
      pageId: string,
      layerId: string,
      action: string,
      name?: string,
    ) => {
      const page = readDesignPage(workspacePath, pageId);
      if (!page) return null;
      const index = page.layers.findIndex((item) => item.id === layerId);
      if (index < 0) return null;
      if (action === "rename" && name?.trim()) {
        page.layers[index].name = name.trim();
      } else if (action === "duplicate") {
        const ids = getDesignLayerDescendantIds(page.layers, layerId);
        const idMap = new Map(Array.from(ids).map((id) => [id, randomUUID()]));
        const duplicates = page.layers
          .filter((layer) => ids.has(layer.id))
          .map((layer) => ({
            ...layer,
            id: idMap.get(layer.id)!,
            name: layer.id === layerId ? `${layer.name} Copy` : layer.name,
            parentId:
              layer.parentId && idMap.has(layer.parentId)
                ? idMap.get(layer.parentId)!
                : layer.parentId,
            componentId:
              layer.componentId && idMap.has(layer.componentId)
                ? idMap.get(layer.componentId)!
                : layer.componentId,
            instanceOf:
              layer.instanceOf && idMap.has(layer.instanceOf)
                ? idMap.get(layer.instanceOf)!
                : layer.instanceOf,
          }));
        page.layers.splice(index + 1, 0, ...duplicates);
      } else if (action === "delete") {
        const deleted = getDesignLayerDescendantIds(page.layers, layerId);
        page.layers = page.layers.filter((layer) => !deleted.has(layer.id));
      }
      writeDesignPage(workspacePath, page);
      const manifest = readDesignManifest(workspacePath);
      const summary = manifest.pages.find((item) => item.id === pageId);
      if (summary) {
        summary.updatedAt = Date.now();
        summary.layerCount = page.layers.length;
        writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
      }
      return { manifest, page };
    },
  );

  ipcMain.handle(
    "system:designReorder",
    (
      _event,
      workspacePath: string,
      kind: "page" | "layer",
      sourceId: string,
      targetId: string,
      pageId?: string,
      targetPageId?: string,
      reparent?: boolean,
    ) => {
      if (sourceId === targetId) return null;
      if (kind === "page") {
        const manifest = readDesignManifest(workspacePath);
        const sourceIndex = manifest.pages.findIndex((item) => item.id === sourceId);
        const targetIndex = manifest.pages.findIndex((item) => item.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return null;
        const [source] = manifest.pages.splice(sourceIndex, 1);
        manifest.pages.splice(targetIndex, 0, source);
        writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
        return {
          manifest,
          page: manifest.activePageId ? readDesignPage(workspacePath, manifest.activePageId) : null,
        };
      }
      if (!pageId) return null;
      const page = readDesignPage(workspacePath, pageId);
      if (!page) return null;
      if (targetPageId && targetPageId !== pageId) {
        const targetPage = readDesignPage(workspacePath, targetPageId);
        if (!targetPage) return null;
        const movedIds = getDesignLayerDescendantIds(page.layers, sourceId);
        const moved = page.layers.filter((item) => movedIds.has(item.id));
        if (!moved.length) return null;
        page.layers = page.layers.filter((item) => !movedIds.has(item.id));
        const topLayer = moved.find((item) => item.id === sourceId);
        if (topLayer) topLayer.parentId = null;
        targetPage.layers.push(...moved);
        writeDesignPage(workspacePath, page);
        writeDesignPage(workspacePath, targetPage);
        const manifest = readDesignManifest(workspacePath);
        manifest.activePageId = targetPageId;
        for (const summary of manifest.pages) {
          if (summary.id === pageId) {
            summary.updatedAt = Date.now();
            summary.layerCount = page.layers.length;
          }
          if (summary.id === targetPageId) {
            summary.updatedAt = Date.now();
            summary.layerCount = targetPage.layers.length;
          }
        }
        writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
        return { manifest, page: targetPage };
      }
      const sourceIndex = page.layers.findIndex((item) => item.id === sourceId);
      const targetIndex = page.layers.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return null;
      if (reparent) {
        const source = page.layers[sourceIndex];
        const target = page.layers[targetIndex];
        if (target.type !== "frame" && target.type !== "group") return null;
        const movedIds = getDesignLayerDescendantIds(page.layers, sourceId);
        if (movedIds.has(targetId)) return null;
        const byId = new Map(page.layers.map((layer) => [layer.id, layer]));
        const absolutePosition = (
          layer: DesignPage["layers"][number],
        ): { x: number; y: number } => {
          const parent = layer.parentId ? byId.get(layer.parentId) : null;
          const parentPosition = parent ? absolutePosition(parent) : { x: 0, y: 0 };
          return { x: parentPosition.x + layer.x, y: parentPosition.y + layer.y };
        };
        const sourcePosition = absolutePosition(source);
        const targetPosition = absolutePosition(target);
        source.parentId = targetId;
        source.x = sourcePosition.x - targetPosition.x;
        source.y = sourcePosition.y - targetPosition.y;
        writeDesignPage(workspacePath, page);
        const manifest = readDesignManifest(workspacePath);
        const summary = manifest.pages.find((item) => item.id === pageId);
        if (summary) summary.updatedAt = Date.now();
        writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
        return { manifest, page };
      }
      const [source] = page.layers.splice(sourceIndex, 1);
      page.layers.splice(targetIndex, 0, source);
      writeDesignPage(workspacePath, page);
      const manifest = readDesignManifest(workspacePath);
      const summary = manifest.pages.find((item) => item.id === pageId);
      if (summary) summary.updatedAt = Date.now();
      writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
      return { manifest, page };
    },
  );

  ipcMain.handle(
    "system:designCreateShape",
    (
      _event,
      workspacePath: string,
      pageId: string,
      shape: Pick<DesignPage["layers"][number], "type" | "x" | "y" | "width" | "height"> & {
        points?: Array<{ x: number; y: number }>;
      },
    ) => {
      const page = readDesignPage(workspacePath, pageId);
      if (!page) return null;
      const names: Record<string, string> = {
        frame: "Frame",
        rectangle: "Rectangle",
        ellipse: "Ellipse",
        triangle: "Triangle",
        text: "Text",
        draw: "Drawing",
      };
      page.layers.push({
        id: randomUUID(),
        name: `${names[shape.type] || "Layer"} ${page.layers.length + 1}`,
        type: shape.type,
        parentId: null,
        visible: true,
        locked: false,
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        fill: shape.type === "text" || shape.type === "draw" ? "#f4f4f5" : "#d9d9d9",
        text: shape.type === "text" ? "Text" : undefined,
        points: shape.points,
      });
      writeDesignPage(workspacePath, page);
      const manifest = readDesignManifest(workspacePath);
      const summary = manifest.pages.find((item) => item.id === pageId);
      if (summary) {
        summary.updatedAt = Date.now();
        summary.layerCount = page.layers.length;
        writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
      }
      return { manifest, page };
    },
  );

  ipcMain.handle(
    "system:designUpdateLayer",
    (_event, workspacePath: string, pageId: string, layerId: string, patch: object) => {
      const page = readDesignPage(workspacePath, pageId);
      if (!page) return null;
      const layer = page.layers.find((item) => item.id === layerId);
      if (!layer) return null;
      const allowedNumbers = [
        "x",
        "y",
        "width",
        "height",
        "layoutGap",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
      ] as const;
      const allowedStrings = ["name", "vectorPath", "windingRule", "text", "layoutMode"] as const;
      const allowedArrays = ["points", "fills", "strokes", "effects"] as const;
      for (const key of allowedNumbers) {
        const value = (patch as Record<string, unknown>)[key];
        if (typeof value === "number" && Number.isFinite(value)) layer[key] = value;
      }
      for (const key of allowedStrings) {
        const value = (patch as Record<string, unknown>)[key];
        if (typeof value === "string") (layer as any)[key] = value;
      }
      for (const key of allowedArrays) {
        const value = (patch as Record<string, unknown>)[key];
        if (Array.isArray(value)) (layer as any)[key] = value;
      }
      syncComponentToInstances(page, layerId);
      writeDesignPage(workspacePath, page);
      const manifest = readDesignManifest(workspacePath);
      const summary = manifest.pages.find((item) => item.id === pageId);
      if (summary) {
        summary.updatedAt = Date.now();
        summary.layerCount = page.layers.length;
        writeJsonAtomic(designPaths(workspacePath).manifest, manifest);
      }
      return { manifest, page };
    },
  );

  ipcMain.handle(
    "system:designRestorePage",
    (_event, workspacePath: string, page: DesignPage, activePageId?: string) => {
      const normalized = normalizeDesignImportPage(page, page?.name || "Imported Design");
      const lintReport = lintDesignPage(normalized.page);
      if (lintReport.findings.length) console.warn("[Design lint]", lintReport);
      const result = upsertDesignPage(workspacePath, normalized.page);
      if (activePageId) {
        result.manifest.activePageId = normalized.page.id;
        writeJsonAtomic(designPaths(workspacePath).manifest, result.manifest);
      }
      return result;
    },
  );

  ipcMain.handle("system:designExportFiles", (_event, workspacePath: string, pageId: string) => {
    const page = readDesignPage(workspacePath, pageId);
    if (!page) return { ok: false, error: "Page not found." };
    try {
      const files = buildDesignExportFiles(page);
      const exportDir = join(designPaths(workspacePath).root, "exports", files.pageName);
      mkdirSync(exportDir, { recursive: true });
      writeFileSync(join(exportDir, `${files.pageName}.tsx`), files.tsx);
      writeFileSync(join(exportDir, `${files.pageName}.module.css`), files.css);
      writeFileSync(join(exportDir, `${files.pageName}-tokens.json`), files.tokensJson);
      return { ok: true, path: exportDir, name: files.pageName };
    } catch (error: any) {
      return { ok: false, error: error?.message || "Export error." };
    }
  });

  ipcMain.handle("system:designExportPng", (_event, workspacePath: string, pageId: string) => {
    const page = readDesignPage(workspacePath, pageId);
    if (!page) return { ok: false, error: "Page not found." };
    try {
      const visible = page.layers.filter((l) => l.visible && l.type !== "group");
      const w = Math.max(1, ...visible.map((l) => l.x + l.width));
      const h = Math.max(1, ...visible.map((l) => l.y + l.height));
      const safeName =
        page.name
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "") || "design";
      const exportDir = join(designPaths(workspacePath).root, "exports", safeName);
      const exportPath = join(exportDir, `${safeName}.png`);
      return {
        ok: true,
        layers: JSON.stringify(page.layers),
        width: w,
        height: h,
        exportPath,
      };
    } catch (error: any) {
      return { ok: false, error: error?.message || "Bounds error." };
    }
  });

  ipcMain.handle("system:designWritePng", (_event, exportPath: string, base64data: string) => {
    try {
      const dir = exportPath.slice(
        0,
        exportPath.lastIndexOf("\\") !== -1
          ? exportPath.lastIndexOf("\\")
          : exportPath.lastIndexOf("/"),
      );
      if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(exportPath, Buffer.from(base64data, "base64"));
      return { ok: true, path: exportPath };
    } catch (error: any) {
      return { ok: false, error: error?.message || "Write error." };
    }
  });

  ipcMain.handle("system:designReadTokens", (_event, workspacePath: string) => {
    return readDesignTokens(workspacePath);
  });

  ipcMain.handle(
    "system:designWriteTokens",
    (_event, workspacePath: string, tokens: DesignTokenCollection) => {
      writeDesignTokens(workspacePath, tokens);
      return { ok: true };
    },
  );

  ipcMain.handle(
    "system:designImportFigma",
    async (_event, workspacePath: string, fileKey: string, token: string) => {
      try {
        const cleanKey = fileKey.trim();
        const cleanToken = token.trim();
        if (!workspacePath || !cleanKey || !cleanToken) {
          return { ok: false, error: "Falta file key o token de Figma." };
        }

        const response = await fetch(
          `https://api.figma.com/v1/files/${encodeURIComponent(cleanKey)}`,
          {
            headers: { "X-Figma-Token": cleanToken },
          },
        );
        if (!response.ok) {
          const message =
            response.status === 403 || response.status === 401
              ? "Token invalido o sin acceso al archivo."
              : `Figma respondio HTTP ${response.status}.`;
          return { ok: false, error: message };
        }

        const figmaFile = await response.json();
        const page = convertFigmaToDesignPage(figmaFile);
        return { ok: true, ...upsertDesignPage(workspacePath, page) };
      } catch (error: any) {
        return { ok: false, error: error?.message || "No se pudo importar desde Figma." };
      }
    },
  );

  ipcMain.handle("system:readTableCsv", (_event, workspacePath: string, tableId: string) => {
    try {
      if (!workspacePath || !tableId) return "";
      const dataDir = join(workspacePath, ".codeclub", "data");
      const csvPath = join(dataDir, `${tableId}.csv`);
      if (existsSync(csvPath)) {
        return readFileContent(csvPath, "utf-8");
      }
    } catch {}
    return "";
  });

  ipcMain.handle(
    "system:writeTableCsv",
    (_event, workspacePath: string, tableId: string, csvContent: string) => {
      try {
        if (!workspacePath || !tableId) return;
        const dataDir = join(workspacePath, ".codeclub", "data");
        if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
        writeFileSync(join(dataDir, `${tableId}.csv`), csvContent);
      } catch {}
    },
  );

  ipcMain.handle("api:getSkills", async (_, workspacePath: string) => {
    if (!workspacePath) return [];
    try {
      const skillsDir = resolve(workspacePath, ".agents/skills");
      if (!existsSync(skillsDir)) return [];
      const skills: { name: string; description: string; content: string }[] = [];
      const dirs = readdirSync(skillsDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          const skillPath = resolve(skillsDir, d.name, "SKILL.md");
          if (existsSync(skillPath)) {
            const content = readFileContent(skillPath, "utf-8");
            let description = "Local workspace skill";
            const descMatch = content.match(/description:\s*>?(.*?)(?:\n---|\n\w+:)/s);
            if (descMatch && descMatch[1]) {
              description = descMatch[1].trim();
            }
            skills.push({ name: d.name, description, content });
          }
        }
      }
      return skills;
    } catch {
      return [];
    }
  });
  let activeSwarmPort: number | null = null;
  let swarmWorker: Electron.UtilityProcess | null = null;

  ipcMain.handle("swarm:port", async () => {
    if (activeSwarmPort) return activeSwarmPort;

    return new Promise((resolve, reject) => {
      if (swarmWorker) {
        // already starting, but this is a race condition simplification
        return;
      }

      const { utilityProcess, _app } = require("electron");
      const { join } = require("path");

      // __dirname is out/main/ipc or just out/main depending on bundle structure.
      // Since tsdown bundles to out/main/index.cjs, __dirname is out/main.
      const workerPath = join(__dirname, "workers", "swarmWorker.cjs");

      swarmWorker = utilityProcess.fork(workerPath);

      swarmWorker?.on("message", (msg) => {
        if (msg.type === "started") {
          activeSwarmPort = msg.port;
          resolve(msg.port);
        } else if (msg.type === "error") {
          console.error("[Swarm Utility Process Error]:", msg.error);
          reject(new Error(msg.error));
        }
      });

      swarmWorker?.on("exit", (code) => {
        console.warn(`[Swarm Worker] exited with code ${code}`);
        swarmWorker = null;
        activeSwarmPort = null;
      });
    });
  });
}
