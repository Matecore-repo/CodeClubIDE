import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import { readFigFile } from "@open-pencil/core/io/formats/fig";
import type {
  DesignFill,
  DesignLayer,
  DesignManifest,
  DesignPage,
  DesignStroke,
  DesignEffect,
} from "../../../../shared/design";
import { exportDesignBundle } from "../../../../shared/designExport";
import { lintDesignPage } from "../../../../shared/designLint";
import { normalizeDesignImportPage } from "../../../../shared/designImportValidation";
import { exportDesignPng } from "../../utils/designExportPng";
import { ExplorerBadge, ExplorerIcon, ExplorerItem, ExplorerLabel } from "./ExplorerItem";
import { useDesignUndo } from "../../hooks/useDesignUndo";
import { s } from "./styles";

const ROW_HEIGHT = 26;

function colorToHex(color?: { r: number; g: number; b: number } | null): string {
  if (!color) return "#d9d9d9";
  const toHex = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function mapFills(fills: any[] | undefined): DesignFill[] | undefined {
  const mapped = (fills ?? [])
    .map((item): DesignFill | null => {
      if (item?.type === "SOLID") {
        return {
          type: "solid",
          color: colorToHex(item.color),
          opacity: typeof item.opacity === "number" ? item.opacity : undefined,
          visible: item.visible !== false,
        };
      }
      if (item?.type === "GRADIENT_LINEAR" || item?.type === "GRADIENT_RADIAL") {
        const stops = (item.gradientStops ?? [])
          .filter((stop: any) => stop?.color)
          .map((stop: any) => ({
            color: colorToHex(stop.color),
            position: typeof stop.position === "number" ? stop.position : 0,
            opacity: typeof stop.color?.a === "number" ? stop.color.a : undefined,
          }));
        if (!stops.length) return null;
        const rawTransform = item.gradientTransform;
        const transform =
          Array.isArray(rawTransform) && rawTransform.length === 2
            ? [...(rawTransform[0] ?? []), ...(rawTransform[1] ?? [])].filter(
                (v) => typeof v === "number" && Number.isFinite(v),
              )
            : undefined;
        return {
          type: item.type === "GRADIENT_RADIAL" ? "radial-gradient" : "linear-gradient",
          stops,
          transform: transform?.length === 6 ? transform : undefined,
          opacity: typeof item.opacity === "number" ? item.opacity : undefined,
          visible: item.visible !== false,
        };
      }
      return null;
    })
    .filter(Boolean) as DesignFill[];
  return mapped.length ? mapped : undefined;
}

function mapEffects(effects: any[] | undefined): DesignEffect[] | undefined {
  const mapped = (effects ?? [])
    .map((item): DesignEffect | null => {
      if (item?.type === "DROP_SHADOW" || item?.type === "INNER_SHADOW") {
        return {
          type: item.type === "INNER_SHADOW" ? "inner-shadow" : "drop-shadow",
          color: colorToHex(item.color),
          x: Number(item.offset?.x) || 0,
          y: Number(item.offset?.y) || 0,
          radius: Number(item.radius) || 0,
          opacity: typeof item.color?.a === "number" ? item.color.a : undefined,
          visible: item.visible !== false,
        };
      }
      if (item?.type === "LAYER_BLUR") {
        return {
          type: "layer-blur",
          radius: Number(item.radius) || 0,
          visible: item.visible !== false,
        };
      }
      return null;
    })
    .filter(Boolean) as DesignEffect[];
  return mapped.length ? mapped : undefined;
}

function mapLayoutMode(value: unknown): DesignLayer["layoutMode"] | undefined {
  if (value === "HORIZONTAL") return "horizontal";
  if (value === "VERTICAL") return "vertical";
  return undefined;
}

function mapLayoutAlign(value: unknown): DesignLayer["layoutAlign"] | undefined {
  if (value === "CENTER") return "center";
  if (value === "MAX") return "end";
  if (value === "SPACE_BETWEEN") return "space-between";
  if (value === "MIN") return "start";
  return undefined;
}

function mapLayoutCrossAlign(value: unknown): DesignLayer["layoutCrossAlign"] | undefined {
  if (value === "CENTER") return "center";
  if (value === "MAX") return "end";
  if (value === "STRETCH") return "stretch";
  if (value === "MIN") return "start";
  return undefined;
}

function mapStrokes(strokes: any[] | undefined): DesignStroke[] | undefined {
  const mapped = (strokes ?? [])
    .filter((item) => item?.color)
    .map((item): DesignStroke => {
      const align: DesignStroke["align"] =
        item.align === "OUTSIDE" ? "outside" : item.align === "CENTER" ? "center" : "inside";
      return {
        color: colorToHex(item.color),
        weight: Number(item.weight) || 1,
        opacity: typeof item.opacity === "number" ? item.opacity : undefined,
        visible: item.visible !== false,
        align,
      };
    });
  return mapped.length ? mapped : undefined;
}

function openPencilTypeToDesignType(type: string): DesignLayer["type"] | null {
  if (type === "FRAME" || type === "COMPONENT" || type === "INSTANCE") return "frame";
  if (type === "GROUP" || type === "COMPONENT_SET" || type === "SECTION") return "group";
  if (type === "RECTANGLE" || type === "ROUNDED_RECTANGLE") return "rectangle";
  if (type === "ELLIPSE") return "ellipse";
  if (type === "TEXT") return "text";
  if (type === "VECTOR" || type === "BOOLEAN_OPERATION" || type === "STAR" || type === "LINE")
    return "draw";
  return null;
}

function mapComponentRole(type: string): DesignLayer["componentRole"] | undefined {
  if (type === "COMPONENT") return "component";
  if (type === "INSTANCE") return "instance";
  if (type === "COMPONENT_SET") return "component-set";
  return undefined;
}

function mapVariantProperties(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(
      ([, item]) =>
        typeof item === "string" || typeof item === "number" || typeof item === "boolean",
    )
    .map(([key, item]) => [key, String(item)] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function openPencilGraphToDesignPage(graph: any, name: string): DesignPage {
  const pageNode = graph.getPages?.()[0];
  if (!pageNode) throw new Error("No pages found in .fig file.");

  const layers: DesignLayer[] = [];
  const visit = (nodeId: string, parentId: string | null) => {
    const node = graph.getNode?.(nodeId);
    if (!node) return;
    const type = openPencilTypeToDesignType(node.type);
    let nextParent = parentId;
    if (type) {
      const layerId = `fig-${String(node.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      const sourceComponentId = node.componentId ?? node.mainComponentId;
      const instanceOf = sourceComponentId
        ? `fig-${String(sourceComponentId).replace(/[^a-zA-Z0-9_-]/g, "-")}`
        : undefined;
      const fill = node.fills?.find(
        (item: any) => item?.visible !== false && item?.type === "SOLID",
      );
      const fills = mapFills(node.fills);
      layers.push({
        id: layerId,
        name: node.name || type,
        type,
        parentId,
        visible: node.visible !== false,
        locked: Boolean(node.locked),
        x: Number(node.x) || 0,
        y: Number(node.y) || 0,
        width: Number(node.width) || 0,
        height: Number(node.height) || 0,
        fill: type === "text" ? colorToHex(fill?.color) : colorToHex(fill?.color),
        fills,
        strokes: mapStrokes(node.strokes),
        effects: mapEffects(node.effects),
        opacity: typeof node.opacity === "number" ? node.opacity : undefined,
        rotation: typeof node.rotation === "number" ? node.rotation : undefined,
        cornerRadius: typeof node.cornerRadius === "number" ? node.cornerRadius : undefined,
        layoutMode: mapLayoutMode(node.layoutMode),
        layoutGap: typeof node.itemSpacing === "number" ? node.itemSpacing : undefined,
        paddingTop: typeof node.paddingTop === "number" ? node.paddingTop : undefined,
        paddingRight: typeof node.paddingRight === "number" ? node.paddingRight : undefined,
        paddingBottom: typeof node.paddingBottom === "number" ? node.paddingBottom : undefined,
        paddingLeft: typeof node.paddingLeft === "number" ? node.paddingLeft : undefined,
        layoutAlign: mapLayoutAlign(node.primaryAxisAlignItems),
        layoutCrossAlign: mapLayoutCrossAlign(node.counterAxisAlignItems),
        componentRole: mapComponentRole(node.type),
        componentId:
          node.type === "COMPONENT" || node.type === "COMPONENT_SET" ? layerId : undefined,
        instanceOf: node.type === "INSTANCE" ? instanceOf : undefined,
        variantProperties: mapVariantProperties(node.variantProperties ?? node.componentProperties),
        isDetachedInstance: node.type === "INSTANCE" && !sourceComponentId,
        clipsContent: Boolean(node.clipsContent),
        vectorPath:
          typeof node.vectorPath === "string"
            ? node.vectorPath
            : typeof node.path === "string"
              ? node.path
              : undefined,
        windingRule:
          node.windingRule === "evenodd" || node.fillRule === "EVENODD" ? "evenodd" : undefined,
        text: type === "text" ? node.text || "" : undefined,
      });
      nextParent = layerId;
    }
    for (const childId of node.childIds ?? []) visit(childId, nextParent);
  };

  for (const childId of pageNode.childIds ?? []) visit(childId, null);
  if (!layers.length) throw new Error("No importable layers found in .fig file.");

  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    layers,
  };
}

function VirtualList<T>({
  items,
  activeIndex,
  renderItem,
}: {
  items: T[];
  activeIndex?: number;
  renderItem: (item: T) => ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 20 });

  const updateRange = (element: HTMLDivElement) => {
    const start = Math.max(0, Math.floor(element.scrollTop / ROW_HEIGHT) - 5);
    const end = Math.min(items.length, start + Math.ceil(element.clientHeight / ROW_HEIGHT) + 10);
    setRange({ start, end });
  };

  useEffect(() => {
    const element = viewportRef.current;
    if (element) updateRange(element);
  }, [items.length]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || activeIndex === undefined || activeIndex < 0) return;
    const top = activeIndex * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (bottom > element.scrollTop + element.clientHeight) {
      element.scrollTop = bottom - element.clientHeight;
    }
    updateRange(element);
  }, [activeIndex]);

  return (
    <div
      ref={viewportRef}
      onScroll={(event: UIEvent<HTMLDivElement>) => updateRange(event.currentTarget)}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "#1a1a1a transparent",
      }}
    >
      <div style={{ position: "relative", height: items.length * ROW_HEIGHT }}>
        {items.slice(range.start, range.end).map((item, index) => (
          <div
            key={range.start + index}
            style={{
              position: "absolute",
              top: (range.start + index) * ROW_HEIGHT,
              left: 0,
              right: 0,
              height: ROW_HEIGHT,
            }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DesignPane({
  workspacePath,
  query,
  activeColor,
}: {
  workspacePath: string;
  query: string;
  activeColor?: string;
}) {
  const [manifest, setManifest] = useState<DesignManifest | null>(null);
  const [page, setPage] = useState<DesignPage | null>(null);
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ type: "page" | "layer"; id: string } | null>(null);
  const clipboardRef = useRef<{ type: "page" | "layer"; id: string } | null>(null);
  const draggedRef = useRef<{ type: "page" | "layer"; id: string } | null>(null);
  const [canvasSelectedIds, setCanvasSelectedIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "page" | "layer";
    id: string;
    name?: string;
  } | null>(null);

  const [renamePrompt, setRenamePrompt] = useState<{
    type: "page" | "layer";
    id: string;
    name?: string;
  } | null>(null);
  const undo = useDesignUndo();
  const pageRef = useRef(page);
  pageRef.current = page;
  const manifestRef = useRef(manifest);
  manifestRef.current = manifest;

  const snap = useCallback(() => {
    const p = pageRef.current;
    const m = manifestRef.current;
    if (p && m) undo.push(structuredClone({ manifest: m, page: p }));
  }, [undo]);

  const restoreSnapshot = useCallback(
    async (snapshot: { manifest: DesignManifest; page: DesignPage }) => {
      const data = await window.api.designRestorePage(
        workspacePath,
        snapshot.page,
        snapshot.manifest.activePageId ?? undefined,
      );
      if (data) {
        setManifest(data.manifest);
        setPage(data.page);
        setExpandedPageId(data.manifest.activePageId);
      }
      undo.unlock();
    },
    [undo, workspacePath],
  );

  useEffect(() => {
    let active = true;
    window.api.designRead(workspacePath).then((data) => {
      if (!active) return;
      setManifest(data.manifest);
      setPage(data.page);
      setExpandedPageId(null);
    });
    return () => {
      active = false;
    };
  }, [workspacePath]);

  useEffect(() => {
    const sendPage = () =>
      window.dispatchEvent(new CustomEvent("codeclub:design-page-state", { detail: page }));
    sendPage();
    window.addEventListener("codeclub:design-request-page", sendPage);
    return () => window.removeEventListener("codeclub:design-request-page", sendPage);
  }, [page]);

  useEffect(() => {
    const createShape = async (event: Event) => {
      if (!page) return;
      snap();
      const data = await window.api.designCreateShape(
        workspacePath,
        page.id,
        (event as CustomEvent).detail,
      );
      if (data) {
        setManifest(data.manifest);
        setPage(data.page);
      }
    };
    const updateLayer = async (event: Event) => {
      if (!page) return;
      const { layerId, patch } = (event as CustomEvent).detail;
      snap();
      const data = await window.api.designUpdateLayer(workspacePath, page.id, layerId, patch);
      if (data) {
        setManifest(data.manifest);
        setPage(data.page);
      }
    };
    window.addEventListener("codeclub:design-create-shape", createShape);
    window.addEventListener("codeclub:design-update-layer", updateLayer);
    return () => {
      window.removeEventListener("codeclub:design-create-shape", createShape);
      window.removeEventListener("codeclub:design-update-layer", updateLayer);
    };
  }, [page, workspacePath]);

  useEffect(() => {
    const receiveSelection = (event: Event) => {
      const ids = (event as CustomEvent<string[]>).detail || [];
      setCanvasSelectedIds(ids);
      if (ids.length) setSelected(null);
    };
    const deleteLayers = async (event: Event) => {
      if (!page) return;
      snap();
      let latest: { manifest: DesignManifest; page: DesignPage } | null = null;
      for (const layerId of (event as CustomEvent<string[]>).detail || []) {
        const data = await window.api.designLayerAction(workspacePath, page.id, layerId, "delete");
        if (data) latest = data;
      }
      if (latest) {
        setManifest(latest.manifest);
        setPage(latest.page);
      }
      setCanvasSelectedIds([]);
    };
    const selectLayer = (event: Event) => {
      const layerId = (event as CustomEvent<string>).detail;
      if (!layerId) return;
      selectSidebarItem({ type: "layer", id: layerId });
    };
    window.addEventListener("codeclub:design-canvas-selection", receiveSelection);
    window.addEventListener("codeclub:design-delete-layers", deleteLayers);
    window.addEventListener("codeclub:design-select-layer", selectLayer);
    return () => {
      window.removeEventListener("codeclub:design-canvas-selection", receiveSelection);
      window.removeEventListener("codeclub:design-delete-layers", deleteLayers);
      window.removeEventListener("codeclub:design-select-layer", selectLayer);
    };
  }, [page, workspacePath]);

  useEffect(() => {
    const createPage = async () => {
      snap();
      const data = await window.api.designCreatePage(workspacePath);
      setManifest(data.manifest);
      setPage(data.page);
      setExpandedPageId(data.page.id);
    };
    const createLayer = async () => {
      let currentPage = page;
      if (!currentPage) {
        snap();
        const data = await window.api.designCreatePage(workspacePath);
        setManifest(data.manifest);
        currentPage = data.page;
        setExpandedPageId(data.page.id);
      }
      if (!currentPage) return;
      snap();
      const data = await window.api.designCreateLayer(workspacePath, currentPage.id);
      if (data) {
        setManifest(data.manifest);
        setPage(data.page);
        setExpandedPageId(currentPage.id);
      }
    };
    const exportFig = () => {
      if (!pageRef.current) return;
      const bundle = exportDesignBundle(pageRef.current);
      const dataStr =
        "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bundle, null, 2));
      const a = document.createElement("a");
      a.href = dataStr;
      a.download = `${pageRef.current.name}.codeclub-design.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    const exportCode = async () => {
      const currentPage = pageRef.current;
      if (!currentPage) return;
      const result = await window.api.designExportFiles(workspacePath, currentPage.id);
      if (!result?.ok) alert(result?.error || "No se pudo exportar el codigo.");
    };
    const exportPng = async () => {
      const currentPage = pageRef.current;
      if (!currentPage) return;
      const result = await exportDesignPng(workspacePath, currentPage.id);
      if (!result.ok) alert(result.error || "No se pudo exportar PNG.");
    };
    const importFig = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".fim,.fig,.json";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          snap();
          let importedPage: DesignPage | null = null;
          if (file.name.toLowerCase().endsWith(".json")) {
            const parsed = JSON.parse(await file.text());
            if (parsed.layers && parsed.id) importedPage = parsed;
          } else {
            try {
              const parsed = JSON.parse(await file.text());
              if (parsed.layers && parsed.id) importedPage = parsed;
            } catch {
              const graph = await readFigFile(file, { populate: "first-page" });
              importedPage = openPencilGraphToDesignPage(
                graph,
                file.name.replace(/\.[^.]+$/i, "") || "Imported .fig",
              );
            }
          }
          if (!importedPage) {
            alert("El archivo no tiene formato de página Design compatible.");
            return;
          }
          const normalized = normalizeDesignImportPage(
            importedPage,
            file.name.replace(/\.[^.]+$/i, "") || "Imported Design",
          );
          if (normalized.warnings.length) {
            console.warn("[Design import]", normalized.warnings.join("\n"));
          }
          const lintReport = lintDesignPage(normalized.page);
          if (lintReport.findings.length) {
            console.warn("[Design lint]", lintReport);
          }
          const data = await window.api.designRestorePage(
            workspacePath,
            normalized.page,
            manifestRef.current?.activePageId ?? undefined,
          );
          if (data) {
            setManifest(data.manifest);
            setPage(data.page);
            setExpandedPageId(data.page.id);
            window.dispatchEvent(
              new CustomEvent("codeclub:design-page-selected", { detail: true }),
            );
          }
        } catch (err: any) {
          alert(err?.message || "No se pudo importar el archivo .fig.");
        }
      };
      input.click();
    };
    window.addEventListener("codeclub:design-add-page", createPage);
    window.addEventListener("codeclub:design-add-layer", createLayer);
    window.addEventListener("codeclub:design-export-fig", exportFig);
    window.addEventListener("codeclub:design-export-code", exportCode);
    window.addEventListener("codeclub:design-export-png", exportPng);
    window.addEventListener("codeclub:design-import-fig", importFig);
    return () => {
      window.removeEventListener("codeclub:design-add-page", createPage);
      window.removeEventListener("codeclub:design-add-layer", createLayer);
      window.removeEventListener("codeclub:design-export-fig", exportFig);
      window.removeEventListener("codeclub:design-export-code", exportCode);
      window.removeEventListener("codeclub:design-export-png", exportPng);
      window.removeEventListener("codeclub:design-import-fig", importFig);
    };
  }, [page, workspacePath]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const pages = useMemo(
    () =>
      (manifest?.pages ?? []).filter((item) => item.name.toLowerCase().includes(normalizedQuery)),
    [manifest?.pages, normalizedQuery],
  );
  const layers = useMemo(
    () => (page?.layers ?? []).filter((item) => item.name.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery, page?.layers],
  );
  const visibleEntries = useMemo(() => {
    const layerEntries = () => {
      const byParent = new Map<string | null, DesignLayer[]>();
      for (const layer of layers) {
        const parentId =
          layer.parentId && page?.layers.some((candidate) => candidate.id === layer.parentId)
            ? layer.parentId
            : null;
        const children = byParent.get(parentId) ?? [];
        children.push(layer);
        byParent.set(parentId, children);
      }
      const entries: Array<{
        type: "layer";
        id: string;
        name: string;
        layer: DesignLayer;
        depth: number;
      }> = [];
      const visit = (parentId: string | null, depth: number) => {
        for (const layer of byParent.get(parentId) ?? []) {
          entries.push({ type: "layer", id: layer.id, name: layer.name, layer, depth });
          visit(layer.id, depth + 1);
        }
      };
      visit(null, 1);
      return entries;
    };

    return pages.flatMap((item) => [
      { type: "page" as const, id: item.id, name: item.name, page: item },
      ...(expandedPageId === item.id && page?.id === item.id ? layerEntries() : []),
    ]);
  }, [expandedPageId, layers, page?.id, page?.layers, pages]);

  const selectPage = async (pageId: string) => {
    if (expandedPageId === pageId) {
      window.dispatchEvent(new CustomEvent("codeclub:design-page-selected", { detail: true }));
      return;
    }
    const selected = await window.api.designSelectPage(workspacePath, pageId);
    if (!selected) return;
    setPage(selected);
    setExpandedPageId(pageId);
    setManifest((current) => (current ? { ...current, activePageId: pageId } : current));
    window.dispatchEvent(new CustomEvent("codeclub:design-page-selected", { detail: true }));
  };

  const selectSidebarItem = (next: { type: "page" | "layer"; id: string }) => {
    window.dispatchEvent(new CustomEvent("codeclub:design-clear-canvas-selection"));
    setCanvasSelectedIds([]);
    setSelected(next);
  };

  const openContextMenu = (
    event: ReactMouseEvent,
    type: "page" | "layer",
    id: string,
    name: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 140;
    const menuHeight = 150;
    const x = Math.max(0, Math.min(event.clientX, window.innerWidth - menuWidth));
    const y = Math.max(0, Math.min(event.clientY, window.innerHeight - menuHeight));
    setContextMenu({ x, y, type, id, name });
  };

  const runTargetAction = async (
    target: { type: "page" | "layer"; id: string; name?: string },
    action: "duplicate" | "rename" | "delete",
  ) => {
    if (action === "rename") {
      setRenamePrompt(target);
      setContextMenu(null);
      return;
    }

    if (target.type === "page") {
      snap();
      const data = await window.api.designPageAction(workspacePath, target.id, action, undefined);
      if (data) {
        setManifest(data.manifest);
        setPage(data.page);
        setExpandedPageId(data.manifest.activePageId);
        if (action === "duplicate" && data.manifest.activePageId) {
          setSelected({ type: "page", id: data.manifest.activePageId });
        }
      }
    } else if (page) {
      snap();
      const data = await window.api.designLayerAction(
        workspacePath,
        page.id,
        target.id,
        action,
        undefined,
      );
      if (data) {
        setManifest(data.manifest);
        setPage(data.page);
      }
    }
    if (action === "delete") setSelected(null);
    setContextMenu(null);
  };

  const reorder = async (target: { type: "page" | "layer"; id: string; reparent?: boolean }) => {
    const source = draggedRef.current;
    if (!source || (source.type !== target.type && source.type !== "layer")) return;
    if (source.type === target.type && source.id === target.id) return;
    snap();
    const targetPageId = source.type === "layer" && target.type === "page" ? target.id : undefined;
    const data = await window.api.designReorder(
      workspacePath,
      source.type,
      source.id,
      target.id,
      source.type === "layer" ? page?.id : undefined,
      targetPageId,
      target.reparent,
    );
    if (data) {
      setManifest(data.manifest);
      setPage(data.page);
    }
    draggedRef.current = null;
  };

  const submitRename = async (newName: string) => {
    const target = renamePrompt;
    setRenamePrompt(null);
    if (!target || !newName.trim()) return;
    const nextName = newName.trim();
    if (target.type === "page") {
      snap();
      const data = await window.api.designPageAction(workspacePath, target.id, "rename", nextName);
      if (data) {
        setManifest(data.manifest);
        setPage(data.page);
        setExpandedPageId(data.manifest.activePageId);
      }
    } else if (page) {
      snap();
      const data = await window.api.designLayerAction(
        workspacePath,
        page.id,
        target.id,
        "rename",
        nextName,
      );
      if (data) {
        setManifest(data.manifest);
        setPage(data.page);
      }
    }
  };

  const runAction = async (action: "duplicate" | "rename" | "delete") => {
    if (contextMenu) await runTargetAction(contextMenu, action);
  };

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("codeclub:design-selection-state", { detail: Boolean(selected) }),
    );
    return () => {
      window.dispatchEvent(new CustomEvent("codeclub:design-selection-state", { detail: false }));
    };
  }, [selected]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (
        element?.tagName === "INPUT" ||
        element?.tagName === "TEXTAREA" ||
        element?.isContentEditable
      )
        return;

      if (event.key === "Escape" && selected) {
        event.preventDefault();
        setSelected(null);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          const snapshot = undo.redo();
          if (snapshot) void restoreSnapshot(snapshot);
        } else {
          const snapshot = undo.undo();
          if (snapshot) void restoreSnapshot(snapshot);
        }
      } else if ((event.key === "ArrowUp" || event.key === "ArrowDown") && selected) {
        event.preventDefault();
        const index = visibleEntries.findIndex(
          (item) => item.id === selected.id && item.type === selected.type,
        );
        const direction = event.key === "ArrowUp" ? -1 : 1;
        const next =
          visibleEntries[Math.max(0, Math.min(visibleEntries.length - 1, index + direction))];
        if (!next) return;
        selectSidebarItem({ type: next.type, id: next.id });
        if (next.type === "page" && next.id !== manifest?.activePageId) void selectPage(next.id);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && selected) {
        event.preventDefault();
        clipboardRef.current = selected;
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        const copied = clipboardRef.current;
        if (!copied) return;
        event.preventDefault();
        const item =
          copied.type === "page"
            ? manifest?.pages.find((entry) => entry.id === copied.id)
            : page?.layers.find((entry) => entry.id === copied.id);
        if (item) void runTargetAction({ ...copied, name: item.name }, "duplicate");
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selected) {
        event.preventDefault();
        const item =
          selected.type === "page"
            ? manifest?.pages.find((entry) => entry.id === selected.id)
            : page?.layers.find((entry) => entry.id === selected.id);
        if (item) void runTargetAction({ ...selected, name: item.name }, "duplicate");
      } else if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        void runTargetAction(selected, "delete");
      } else if (event.key === "F12" && selected) {
        event.preventDefault();
        const item =
          selected.type === "page"
            ? manifest?.pages.find((entry) => entry.id === selected.id)
            : page?.layers.find((entry) => entry.id === selected.id);
        if (item) void runTargetAction({ ...selected, name: item.name }, "rename");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    layers,
    manifest?.pages,
    page,
    pages,
    restoreSnapshot,
    selected,
    visibleEntries,
    workspacePath,
  ]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <VirtualList
        items={visibleEntries}
        activeIndex={visibleEntries.findIndex(
          (item) => item.id === selected?.id && item.type === selected.type,
        )}
        renderItem={(item) =>
          item.type === "page" ? (
            <DesignRow
              label={item.name}
              kind="page"
              expanded={expandedPageId === item.id}
              badge={page?.id === item.id ? page.layers.length : (item.page.layerCount ?? 0)}
              active={selected?.type === "page" && item.id === selected.id}
              activeColor={activeColor}
              onClick={() => {
                selectSidebarItem({ type: "page", id: item.id });
                void selectPage(item.id);
              }}
              onContextMenu={(event) => {
                selectSidebarItem({ type: "page", id: item.id });
                openContextMenu(event, "page", item.id, item.name);
              }}
              draggable
              onDragStart={() => {
                draggedRef.current = { type: "page", id: item.id };
              }}
              onDrop={() => void reorder({ type: "page", id: item.id })}
            />
          ) : (
            <DesignRow
              label={item.name}
              kind="layer"
              depth={item.depth}
              badge={
                item.layer.componentRole === "component"
                  ? "C"
                  : item.layer.componentRole === "instance"
                    ? "I"
                    : item.layer.componentRole === "component-set"
                      ? "V"
                      : undefined
              }
              active={
                (item.id === selected?.id && selected.type === "layer") ||
                canvasSelectedIds.includes(item.id)
              }
              activeColor={activeColor}
              onClick={() => selectSidebarItem({ type: "layer", id: item.id })}
              onContextMenu={(event) => {
                selectSidebarItem({ type: "layer", id: item.id });
                openContextMenu(event, "layer", item.id, item.name);
              }}
              draggable
              onDragStart={() => {
                draggedRef.current = { type: "layer", id: item.id };
              }}
              onDrop={() =>
                void reorder({
                  type: "layer",
                  id: item.id,
                  reparent: item.layer.type === "frame" || item.layer.type === "group",
                })
              }
            />
          )
        }
      />
      {contextMenu && (
        <div
          style={{ ...s.contextMenu, left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <DesignMenuButton
            label={contextMenu.type === "page" ? "New Page" : "New Layer"}
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent(
                  contextMenu.type === "page"
                    ? "codeclub:design-add-page"
                    : "codeclub:design-add-layer",
                ),
              );
              setContextMenu(null);
            }}
          />
          <DesignMenuButton label="Duplicate" onClick={() => void runAction("duplicate")} />
          <div style={s.menuSep} />
          <DesignMenuButton label="Rename" onClick={() => void runAction("rename")} />
          <DesignMenuButton label="Delete" onClick={() => void runAction("delete")} />
        </div>
      )}

      {renamePrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <form
            style={{
              background: "#222",
              padding: 20,
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              width: 300,
              border: "1px solid #333",
            }}
            onSubmit={(e) => {
              e.preventDefault();
              submitRename(new FormData(e.currentTarget).get("name") as string);
            }}
          >
            <label style={{ color: "#ccc", fontSize: 13 }}>Rename {renamePrompt.type}</label>
            <input
              name="name"
              defaultValue={renamePrompt.name}
              autoFocus
              onFocus={(e) => e.target.select()}
              style={{
                padding: "6px 8px",
                background: "#111",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: 4,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setRenamePrompt(null)}
                style={{
                  padding: "4px 12px",
                  background: "transparent",
                  color: "#ccc",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: "4px 12px",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function DesignRow({
  label,
  kind,
  depth = 0,
  expanded: _expanded,
  badge,
  active,
  activeColor,
  onClick,
  onContextMenu,
  draggable,
  onDragStart,
  onDrop,
}: {
  label: string;
  kind: "page" | "layer";
  depth?: number;
  expanded?: boolean;
  badge?: number | string;
  active?: boolean;
  activeColor?: string;
  onClick?: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDrop?: () => void;
}) {
  const dragImageRef = useRef<HTMLDivElement | null>(null);
  return (
    <ExplorerItem
      as="button"
      active={active}
      activeColor={activeColor}
      depth={depth}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={(event) => {
        const badge = document.createElement("div");
        badge.textContent = `• Dragging ${label}`;
        Object.assign(badge.style, {
          position: "fixed",
          left: "-1000px",
          top: "-1000px",
          padding: "6px 10px",
          borderRadius: "6px",
          background: "#111111",
          border: "1px solid #444",
          color: "#f5f5f6",
          fontSize: "12px",
        });
        document.body.appendChild(badge);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", label);
        event.dataTransfer.setDragImage(badge, 12, 14);
        dragImageRef.current = badge;
        onDragStart?.();
      }}
      onDragEnd={() => {
        dragImageRef.current?.remove();
        dragImageRef.current = null;
      }}
      onDragOver={(event) => {
        if (draggable) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop?.();
      }}
      style={{ height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT}px` }}
    >
      <ExplorerIcon>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          {kind === "page" ? (
            <path d="M6 3h9l3 3v15H6Zm9 0v4h4" />
          ) : (
            <path d="m12 4 8 4-8 4-8-4Zm-8 9 8 4 8-4" />
          )}
        </svg>
      </ExplorerIcon>
      <ExplorerLabel>{label}</ExplorerLabel>
      {badge !== undefined && <ExplorerBadge>{badge}</ExplorerBadge>}
    </ExplorerItem>
  );
}

function DesignMenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      style={s.menuItem}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = "var(--surface-base)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "transparent";
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
