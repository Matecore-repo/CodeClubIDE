import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { DesignLayer, DesignPage } from "../../../shared/design";
import { absolutizeDesignLayers } from "../../../shared/designLayers";
import { lintDesignPage } from "../../../shared/designLint";

const MIN_ZOOM = 10;
const MAX_ZOOM = 400;
const ZOOM_STEP = 10;
type DesignTool = "select" | "frame" | "rectangle" | "ellipse" | "triangle" | "text" | "draw";
type ShapeTool = Exclude<DesignTool, "select" | "frame" | "text" | "draw">;
type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function getNiceStep(minimum: number) {
  const magnitude = 10 ** Math.floor(Math.log10(minimum));
  const normalized = minimum / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

function getVisibleTicks(length: number, origin: number, pixelsPerUnit: number, step: number) {
  const firstValue = Math.ceil(-origin / pixelsPerUnit / step) * step;
  const lastValue = Math.floor((length - origin) / pixelsPerUnit / step) * step;
  const count = Math.max(0, Math.round((lastValue - firstValue) / step) + 1);

  return Array.from({ length: count }, (_, index) => {
    const value = firstValue + index * step;
    return { value, position: origin + value * pixelsPerUnit };
  });
}

export function CanvasPanel({
  toolbarVisible,
  activeColor,
}: {
  toolbarVisible: boolean;
  activeColor?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<
    | { type: "pan"; x: number; y: number; panX: number; panY: number }
    | { type: "select"; x: number; y: number }
    | { type: "create"; tool: Exclude<DesignTool, "select">; x: number; y: number }
    | { type: "draw"; points: Array<{ x: number; y: number }> }
    | { type: "move"; layer: DesignLayer; x: number; y: number }
    | { type: "resize"; layer: DesignLayer; handle: ResizeHandle; x: number; y: number }
    | null
  >(null);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(100);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [tool, setTool] = useState<DesignTool>("select");
  const [rightToolbarVisible, setRightToolbarVisible] = useState(true);
  const [autoLayoutMenuVisible, setAutoLayoutMenuVisible] = useState(false);
  const [exportMenuVisible, setExportMenuVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState<"PNG" | "JSX" | "TW">("PNG");
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(1);
  const [shapeTool, setShapeTool] = useState<ShapeTool>("rectangle");
  const [page, setPage] = useState<DesignPage | null>(null);
  const [auditVisible, setAuditVisible] = useState(false);
  const lastAuditIssueCountRef = useRef<number | null>(null);
  const lastAuditPageIdRef = useRef<string | null>(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<{
    type: Exclude<DesignTool, "select">;
    x: number;
    y: number;
    width: number;
    height: number;
    points?: Array<{ x: number; y: number }>;
  } | null>(null);
  const [layerPatch, setLayerPatch] = useState<{
    layerId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [pendingLayerPatch, setPendingLayerPatch] = useState<{
    layerId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [colorPatch, setColorPatch] = useState<{ fill: string } | null>(null);
  const colorTimeoutRef = useRef<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [interaction, setInteraction] = useState<"idle" | "panning" | "selecting">("idle");
  const [selection, setSelection] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const rulerSize = 20;
  const scale = zoom / 100;
  const viewportWidth = Math.max(0, panelSize.width - rulerSize);
  const viewportHeight = Math.max(0, panelSize.height - rulerSize);
  const rulerStep = getNiceStep(64 / scale);
  const gridSize = (rulerStep * scale) / 5;
  const originX = viewportWidth / 2 + pan.x;
  const originY = viewportHeight / 2 + pan.y;
  const screenToWorld = useCallback(
    (point: { x: number; y: number }) => ({
      x: (point.x - originX) / scale,
      y: (point.y - originY) / scale,
    }),
    [originX, originY, scale],
  );
  const worldToScreen = useCallback(
    (point: { x: number; y: number }) => ({
      x: originX + point.x * scale,
      y: originY + point.y * scale,
    }),
    [originX, originY, scale],
  );

  const horizontalTicks = useMemo(
    () => getVisibleTicks(viewportWidth, originX, scale, rulerStep),
    [originX, scale, rulerStep, viewportWidth],
  );
  const verticalTicks = useMemo(
    () => getVisibleTicks(viewportHeight, originY, scale, rulerStep),
    [originY, scale, rulerStep, viewportHeight],
  );
  const [absoluteLayers, setAbsoluteLayers] = useState<DesignLayer[]>([]);
  const toLocalPatch = useCallback(
    (patch: { layerId: string; x: number; y: number; width: number; height: number }) => {
      const layer = absoluteLayers.find((item) => item.id === patch.layerId);
      const parent = layer?.parentId
        ? absoluteLayers.find((item) => item.id === layer.parentId)
        : null;
      return {
        ...patch,
        x: patch.x - (parent?.x ?? 0),
        y: patch.y - (parent?.y ?? 0),
      };
    },
    [absoluteLayers],
  );
  const renderedLayers = useMemo(
    () =>
      absoluteLayers.map((layer) => {
        const visualPatch = layerPatch ?? pendingLayerPatch;
        let l = visualPatch?.layerId === layer.id ? { ...layer, ...visualPatch } : layer;
        if (colorPatch && selectedLayerIds.includes(layer.id)) {
          l = {
            ...l,
            fill: colorPatch.fill,
            fills: [{ type: "solid" as const, color: colorPatch.fill }],
          };
        }
        return l;
      }),
    [absoluteLayers, layerPatch, pendingLayerPatch, colorPatch, selectedLayerIds],
  );
  const auditReport = useMemo(() => (page ? lintDesignPage(page) : null), [page]);
  const auditIssueCount = auditReport ? auditReport.summary.error + auditReport.summary.warning : 0;
  useEffect(() => {
    if (page) {
      let cancelled = false;
      absolutizeDesignLayers(page.layers).then((result) => {
        if (!cancelled) setAbsoluteLayers(result);
      });
      return () => {
        cancelled = true;
      };
    }
    setAbsoluteLayers([]);
  }, [page]);

  useEffect(() => {
    if (!pendingLayerPatch) return;
    const layer = absoluteLayers.find((item) => item.id === pendingLayerPatch.layerId);
    if (
      layer &&
      layer.x === pendingLayerPatch.x &&
      layer.y === pendingLayerPatch.y &&
      layer.width === pendingLayerPatch.width &&
      layer.height === pendingLayerPatch.height
    ) {
      setPendingLayerPatch(null);
    }
  }, [absoluteLayers, pendingLayerPatch]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setPanelSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("codeclub:design-canvas-selection", { detail: selectedLayerIds }),
    );
    window.dispatchEvent(
      new CustomEvent("codeclub:design-selection-state", { detail: selectedLayerIds.length > 0 }),
    );
    return () => {
      window.dispatchEvent(new CustomEvent("codeclub:design-selection-state", { detail: false }));
    };
  }, [selectedLayerIds]);

  useEffect(() => {
    const handleDelete = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (
        element?.tagName === "INPUT" ||
        element?.tagName === "TEXTAREA" ||
        element?.isContentEditable
      )
        return;
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selectedLayerIds.length) return;
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent("codeclub:design-delete-layers", { detail: selectedLayerIds }),
        );
        setSelectedLayerIds([]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setSelectedLayerIds([]);
        setDraft(null);
        setLayerPatch(null);
        setTool("select");
      } else if (event.key.startsWith("Arrow")) {
        if (!selectedLayerIds.length) {
          if (event.key === "ArrowRight") setRightToolbarVisible(false);
          else if (event.key === "ArrowLeft") setRightToolbarVisible(true);
          return;
        }
        event.preventDefault();
        const delta = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0;
        const dy = event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0;
        absoluteLayers
          .filter((layer) => selectedLayerIds.includes(layer.id) && !layer.locked)
          .forEach((layer) => {
            const patch = toLocalPatch({
              layerId: layer.id,
              x: layer.x + dx,
              y: layer.y + dy,
              width: layer.width,
              height: layer.height,
            });
            window.dispatchEvent(
              new CustomEvent("codeclub:design-update-layer", {
                detail: { layerId: layer.id, patch },
              }),
            );
          });
      }
    };
    window.addEventListener("keydown", handleDelete);
    return () => window.removeEventListener("keydown", handleDelete);
  }, [absoluteLayers, selectedLayerIds, toLocalPatch]);

  useEffect(() => {
    const receivePage = (event: Event) => {
      setPage((event as CustomEvent).detail);
    };
    const clearSelection = () => setSelectedLayerIds([]);
    window.addEventListener("codeclub:design-page-state", receivePage);
    window.addEventListener("codeclub:design-clear-canvas-selection", clearSelection);
    window.dispatchEvent(new CustomEvent("codeclub:design-request-page"));
    return () => {
      window.removeEventListener("codeclub:design-page-state", receivePage);
      window.removeEventListener("codeclub:design-clear-canvas-selection", clearSelection);
    };
  }, []);

  const changeZoom = useCallback((amount: number) => {
    setZoom((current) => clampZoom(current + amount));
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = panelRef.current?.getBoundingClientRect();
        if (!rect) return;
        const point = {
          x: event.clientX - rect.left - rulerSize,
          y: event.clientY - rect.top - rulerSize,
        };
        const nextZoom = clampZoom(zoom * Math.exp(-event.deltaY * 0.0015));
        const nextScale = nextZoom / 100;
        const world = screenToWorld(point);
        setPan({
          x: point.x - world.x * nextScale - viewportWidth / 2,
          y: point.y - world.y * nextScale - viewportHeight / 2,
        });
        setZoom(nextZoom);
        return;
      }
      setPan((current) => ({
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    },
    [screenToWorld, viewportHeight, viewportWidth, zoom],
  );

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.addEventListener("wheel", handleWheel, { passive: false });
    return () => panel.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    if (!auditVisible) return;
    const timeout = window.setTimeout(() => setAuditVisible(false), 10000);
    return () => window.clearTimeout(timeout);
  }, [auditVisible]);

  useEffect(() => {
    if (!page) {
      lastAuditIssueCountRef.current = null;
      lastAuditPageIdRef.current = null;
      return;
    }
    if (lastAuditPageIdRef.current !== page.id) {
      lastAuditPageIdRef.current = page.id;
      lastAuditIssueCountRef.current = auditIssueCount;
      return;
    }
    const previousIssueCount = lastAuditIssueCountRef.current ?? auditIssueCount;
    if (auditIssueCount > previousIssueCount) {
      setAuditVisible(true);
    }
    lastAuditIssueCountRef.current = auditIssueCount;
  }, [auditIssueCount, page]);

  const getPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = panelRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0) - rulerSize,
      y: event.clientY - (rect?.top ?? 0) - rulerSize,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const point = getPoint(event);
    const insideViewport = point.x >= 0 && point.y >= 0;

    if (event.button === 1) {
      event.preventDefault();
      gestureRef.current = { type: "pan", ...point, panX: pan.x, panY: pan.y };
      setInteraction("panning");
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (event.button === 0 && tool === "draw" && insideViewport) {
      event.preventDefault();
      const world = screenToWorld(point);
      gestureRef.current = { type: "draw", points: [world] };
      setDraft({ type: "draw", ...world, width: 1, height: 1, points: [{ x: 0, y: 0 }] });
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (event.button === 0 && tool !== "select" && insideViewport) {
      event.preventDefault();
      const world = screenToWorld(point);
      gestureRef.current = { type: "create", tool, ...world };
      setDraft({ type: tool, ...world, width: 1, height: 1 });
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if ((event.button === 0 || event.button === 2) && insideViewport) {
      event.preventDefault();
      const world = screenToWorld(point);
      const hit = [...absoluteLayers]
        .reverse()
        .find(
          (layer) =>
            layer.visible &&
            !layer.locked &&
            layer.type !== "group" &&
            world.x >= layer.x &&
            world.x <= layer.x + layer.width &&
            world.y >= layer.y &&
            world.y <= layer.y + layer.height,
        );
      if (hit) {
        setSelectedLayerIds([hit.id]);
        gestureRef.current = { type: "move", layer: hit, ...world };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      gestureRef.current = { type: "select", ...point };
      setInteraction("selecting");
      setSelection({ left: point.x, top: point.y, width: 0, height: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const point = getPoint(event);

    if (gesture.type === "pan") {
      setPan({ x: gesture.panX + point.x - gesture.x, y: gesture.panY + point.y - gesture.y });
    } else if (gesture.type === "select") {
      setSelection({
        left: Math.min(gesture.x, point.x),
        top: Math.min(gesture.y, point.y),
        width: Math.abs(point.x - gesture.x),
        height: Math.abs(point.y - gesture.y),
      });
    } else if (gesture.type === "create") {
      const world = screenToWorld(point);
      setDraft({
        type: gesture.tool,
        x: Math.min(gesture.x, world.x),
        y: Math.min(gesture.y, world.y),
        width: Math.max(1, Math.abs(world.x - gesture.x)),
        height: Math.max(1, Math.abs(world.y - gesture.y)),
      });
    } else if (gesture.type === "draw") {
      const world = screenToWorld(point);
      gesture.points.push(world);
      const xs = gesture.points.map((item) => item.x);
      const ys = gesture.points.map((item) => item.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      setDraft({
        type: "draw",
        x,
        y,
        width: Math.max(1, Math.max(...xs) - x),
        height: Math.max(1, Math.max(...ys) - y),
        points: gesture.points.map((item) => ({ x: item.x - x, y: item.y - y })),
      });
    } else if (gesture.type === "move") {
      const world = screenToWorld(point);
      setLayerPatch({
        layerId: gesture.layer.id,
        x: gesture.layer.x + world.x - gesture.x,
        y: gesture.layer.y + world.y - gesture.y,
        width: gesture.layer.width,
        height: gesture.layer.height,
      });
    } else {
      const world = screenToWorld(point);
      const deltaX = world.x - gesture.x;
      const deltaY = world.y - gesture.y;
      const left = gesture.handle.includes("w") ? gesture.layer.x + deltaX : gesture.layer.x;
      const top = gesture.handle.includes("n") ? gesture.layer.y + deltaY : gesture.layer.y;
      const right = gesture.handle.includes("e")
        ? gesture.layer.x + gesture.layer.width + deltaX
        : gesture.layer.x + gesture.layer.width;
      const bottom = gesture.handle.includes("s")
        ? gesture.layer.y + gesture.layer.height + deltaY
        : gesture.layer.y + gesture.layer.height;
      const nextLeft = Math.min(left, right - 1);
      const nextTop = Math.min(top, bottom - 1);
      setLayerPatch({
        layerId: gesture.layer.id,
        x: nextLeft,
        y: nextTop,
        width: Math.max(1, right - nextLeft),
        height: Math.max(1, bottom - nextTop),
      });
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gestureRef.current) return;
    const gesture = gestureRef.current;
    gestureRef.current = null;
    setInteraction("idle");
    setSelection(null);
    if (gesture.type === "select" && page) {
      const point = getPoint(event);
      const left = Math.min(gesture.x, point.x);
      const top = Math.min(gesture.y, point.y);
      const right = Math.max(gesture.x, point.x);
      const bottom = Math.max(gesture.y, point.y);
      const ids = absoluteLayers
        .filter((layer) => {
          if (layer.type === "group" || !layer.visible) return false;
          const topLeft = worldToScreen({ x: layer.x || 0, y: layer.y || 0 });
          const layerLeft = topLeft.x;
          const layerTop = topLeft.y;
          const layerRight = layerLeft + (layer.width || 0) * scale;
          const layerBottom = layerTop + (layer.height || 0) * scale;
          return (
            layerLeft <= right && layerRight >= left && layerTop <= bottom && layerBottom >= top
          );
        })
        .map((layer) => layer.id);
      setSelectedLayerIds(ids);
    }
    if ((gesture.type === "create" || gesture.type === "draw") && draft) {
      const created =
        draft.type === "text" && draft.width < 10 && draft.height < 10
          ? { ...draft, width: 120, height: 28 }
          : draft;
      window.dispatchEvent(new CustomEvent("codeclub:design-create-shape", { detail: created }));
      setDraft(null);
      setTool("select");
    } else if ((gesture.type === "move" || gesture.type === "resize") && layerPatch) {
      const patch = toLocalPatch(layerPatch);
      setPendingLayerPatch(layerPatch);
      if (page) {
        setPage({
          ...page,
          layers: page.layers.map((l) => (l.id === layerPatch.layerId ? { ...l, ...patch } : l)),
        });
      }
      window.dispatchEvent(
        new CustomEvent("codeclub:design-update-layer", {
          detail: { layerId: layerPatch.layerId, patch },
        }),
      );
      setLayerPatch(null);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const selectedLayer =
    selectedLayerIds.length === 1 ? absoluteLayers.find((l) => l.id === selectedLayerIds[0]) : null;
  const displayColor =
    colorPatch?.fill || (selectedLayer ? solidLayerFill(selectedLayer) : "#141414");

  return (
    <div
      ref={panelRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        cursor:
          interaction === "panning"
            ? "grabbing"
            : interaction === "selecting"
              ? "crosshair"
              : tool === "text"
                ? "text"
                : tool !== "select"
                  ? "crosshair"
                  : "default",
        backgroundColor: "#111111",
        backgroundImage: gridEnabled
          ? "linear-gradient(#242424 1px, transparent 1px), linear-gradient(90deg, #242424 1px, transparent 1px)"
          : "none",
        backgroundSize: gridEnabled ? `${gridSize}px ${gridSize}px` : undefined,
        backgroundPosition: gridEnabled
          ? `${rulerSize + originX}px ${rulerSize + originY}px`
          : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: rulerSize,
          top: rulerSize,
          right: 0,
          bottom: 0,
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <g transform={`translate(${originX} ${originY}) scale(${scale})`}>
            {renderedLayers.map((layer) => renderSvgLayer(layer))}
            {draft &&
              renderSvgLayer({
                id: "draft",
                name: "Draft",
                parentId: null,
                visible: true,
                locked: false,
                fill: "#d9d9d9",
                ...draft,
              })}
            {renderedLayers
              .filter((layer) => selectedLayerIds.includes(layer.id))
              .map((layer) => renderSelectionOutline(layer, activeColor))}
          </g>
        </svg>
        {renderedLayers
          .filter((layer) => selectedLayerIds.includes(layer.id))
          .flatMap((layer) =>
            resizeHandles(layer).map(({ handle, x, y, cursor }) => {
              const position = worldToScreen({ x, y });
              return (
                <div
                  key={`${layer.id}:${handle}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    const rect = panelRef.current?.getBoundingClientRect();
                    const point = {
                      x: event.clientX - (rect?.left ?? 0) - rulerSize,
                      y: event.clientY - (rect?.top ?? 0) - rulerSize,
                    };
                    const world = screenToWorld(point);
                    gestureRef.current = { type: "resize", layer, handle, ...world };
                    setInteraction("selecting");
                    panelRef.current?.setPointerCapture(event.pointerId);
                  }}
                  style={{
                    position: "absolute",
                    left: position.x - 4,
                    top: position.y - 4,
                    width: 8,
                    height: 8,
                    border: "1px solid #111111",
                    background: activeColor || "#1597f5",
                    cursor,
                    zIndex: 8,
                  }}
                />
              );
            }),
          )}
        {selection && (
          <div
            style={{
              position: "absolute",
              ...selection,
              border: `1px solid ${activeColor || "#1597f5"}`,
              background: `color-mix(in srgb, ${activeColor || "#1597f5"} 16%, transparent)`,
              pointerEvents: "none",
              zIndex: 10,
            }}
          />
        )}
      </div>
      {auditVisible && auditReport && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 72,
            width: 360,
            maxWidth: "calc(100% - 32px)",
            maxHeight: 260,
            transform: "translateX(-50%)",
            border: "1px solid #2b2b2b",
            borderRadius: 8,
            background: "#1b1b1b",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            color: "#e0e0e0",
            overflow: "hidden",
            zIndex: 22,
          }}
        >
          <div
            style={{
              height: 30,
              display: "flex",
              alignItems: "center",
              padding: "0 10px",
              fontSize: 12,
            }}
          >
            <span style={{ fontWeight: 600 }}>Audit</span>
          </div>
          <div style={{ maxHeight: 230, overflow: "auto", padding: 6, fontSize: 12 }}>
            {auditReport.findings.length === 0 ? (
              <div style={{ padding: 6, color: "#85858c" }}>No audit findings</div>
            ) : (
              auditReport.findings.slice(0, 10).map((finding, index) => (
                <button
                  key={`${finding.ruleId}:${finding.layerId ?? "page"}:${index}`}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    display: "flex",
                    gap: 7,
                    padding: "5px 4px",
                    color: "#e0e0e0",
                    cursor: finding.layerId ? "pointer" : "default",
                    textAlign: "left",
                    transition: "background 0.15s ease, border-radius 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (finding.layerId) {
                      e.currentTarget.style.background = "#2b2b2b";
                      e.currentTarget.style.borderRadius = "4px";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                  onClick={() => {
                    if (!finding.layerId) return;
                    window.dispatchEvent(
                      new CustomEvent("codeclub:design-select-layer", {
                        detail: finding.layerId,
                      }),
                    );
                  }}
                >
                  <span style={{ flex: 1 }}>
                    {finding.layerName ? `${finding.layerName}: ` : ""}
                    {finding.message}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: rulerSize,
          right: 0,
          height: rulerSize,
          overflow: "hidden",
          borderBottom: "1px solid #252525",
          background: "#151515",
          color: "#666",
          fontSize: 9,
        }}
      >
        {horizontalTicks.map((tick) => (
          <span
            key={tick.value}
            style={{
              position: "absolute",
              left: tick.position,
              top: 2,
              transform: "translateX(-50%)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {tick.value}
          </span>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 7,
          height: 48,
          padding: "0 10px",
          border: "1px solid #2b2b2b",
          borderRadius: 8,
          background: "#1b1b1b",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          transform: toolbarVisible ? "translate(-50%, 0)" : "translate(-50%, 180%)",
          opacity: toolbarVisible ? 1 : 0,
          pointerEvents: toolbarVisible ? "auto" : "none",
          transition: "transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.2s ease",
          zIndex: 20,
        }}
      >
        {/* Main design tools */}
        <ToolbarButton
          label="Select"
          active={tool === "select"}
          activeColor={activeColor}
          onClick={() => setTool("select")}
        >
          <path d="m6 4 12 8-6 2-3 6Z" />
        </ToolbarButton>
        <ToolbarButton
          label="Frame"
          active={tool === "frame"}
          activeColor={activeColor}
          onClick={() => setTool("frame")}
        >
          <path d="M6 3v18M18 3v18M3 6h18M3 18h18" />
        </ToolbarButton>
        <ToolbarButton
          label={shapeTool[0].toUpperCase() + shapeTool.slice(1)}
          active={tool === shapeTool}
          activeColor={activeColor}
          onClick={() => setTool(shapeTool)}
        >
          <ShapeToolIcon tool={shapeTool} />
        </ToolbarButton>
        <ToolbarButton
          label="Pen"
          active={tool === "draw"}
          activeColor={activeColor}
          onClick={() => setTool("draw")}
        >
          <path d="m4 4 8 2 7 7-6 6-7-7Z" />
          <circle cx="9" cy="9" r="1.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Text"
          active={tool === "text"}
          activeColor={activeColor}
          onClick={() => setTool("text")}
        >
          <path d="M6 5h12M12 5v14M8 19h8" />
        </ToolbarButton>
        <ToolbarButton
          label="Grid"
          active={gridEnabled}
          activeColor={activeColor}
          onClick={() => setGridEnabled((enabled) => !enabled)}
        >
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </ToolbarButton>
        <ToolbarButton
          label="Audit"
          active={auditVisible}
          activeColor={activeColor}
          onClick={() => setAuditVisible((visible) => !visible)}
        >
          <path d="M5 4h14v16H5Z" />
          <path d="M8 8h8M8 12h8M8 16h5" />
          {auditIssueCount > 0 && (
            <>
              <circle cx="18" cy="6" r="4" fill="#f59e0b" stroke="none" />
              <text x="18" y="8.5" textAnchor="middle" fontSize="7" fill="#111111" stroke="none">
                {Math.min(auditIssueCount, 9)}
              </text>
            </>
          )}
        </ToolbarButton>
        <span style={{ width: 1, height: 28, background: "#303030", margin: "0 2px" }} />
        {/* Shape variants */}
        {(["rectangle", "ellipse", "triangle"] as string[]).includes(tool) && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: 3,
                borderRadius: 6,
                background: "#242424",
              }}
            >
              {(["rectangle", "ellipse", "triangle"] as ShapeTool[]).map((shape) => (
                <ToolbarButton
                  key={shape}
                  label={shape[0].toUpperCase() + shape.slice(1)}
                  active={shapeTool === shape}
                  activeColor={activeColor}
                  onClick={() => {
                    setShapeTool(shape);
                    setTool(shape);
                  }}
                >
                  <ShapeToolIcon tool={shape} />
                </ToolbarButton>
              ))}
            </div>
            <span style={{ width: 1, height: 28, background: "#303030", margin: "0 2px" }} />
          </>
        )}
        {/* Canvas zoom */}
        <div style={{ display: "flex", alignItems: "center", color: "#bdbdbd", fontSize: 11 }}>
          <button
            aria-label="Zoom out"
            disabled={zoom === MIN_ZOOM}
            onClick={() => changeZoom(-ZOOM_STEP)}
            style={zoomButtonStyle}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M5 12h14" />
            </svg>
          </button>
          <span style={{ width: 48, textAlign: "center", fontSize: 13, fontWeight: 500 }}>
            {Math.round(zoom)}%
          </span>
          <button
            aria-label="Zoom in"
            disabled={zoom === MAX_ZOOM}
            onClick={() => changeZoom(ZOOM_STEP)}
            style={zoomButtonStyle}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M5 12h14M12 5v14" />
            </svg>
          </button>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: rulerSize,
          bottom: 0,
          left: 0,
          width: rulerSize,
          overflow: "hidden",
          borderRight: "1px solid #252525",
          background: "#151515",
          color: "#666",
          fontSize: 9,
        }}
      >
        {verticalTicks.map((tick) => (
          <span
            key={tick.value}
            style={{
              position: "absolute",
              top: tick.position,
              left: 2,
              transform: "translateY(-50%)",
              writingMode: "vertical-rl",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {tick.value}
          </span>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: rulerSize,
          height: rulerSize,
          background: "#151515",
          borderRight: "1px solid #252525",
          borderBottom: "1px solid #252525",
        }}
      />
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 7,
          width: 48,
          padding: "10px 0",
          border: "1px solid #2b2b2b",
          borderRadius: 8,
          background: "#1b1b1b",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          transform: rightToolbarVisible ? "translate(0, -50%)" : "translate(180%, -50%)",
          opacity: rightToolbarVisible ? 1 : 0,
          pointerEvents: rightToolbarVisible ? "auto" : "none",
          transition: "transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.2s ease",
          zIndex: 20,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 24,
            height: 24,
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid #303030",
            background: displayColor,
            flexShrink: 0,
          }}
        >
          <input
            type="color"
            value={displayColor}
            onChange={(e) => {
              const color = e.target.value;
              setColorPatch({ fill: color });

              if (colorTimeoutRef.current) window.clearTimeout(colorTimeoutRef.current);
              colorTimeoutRef.current = window.setTimeout(() => {
                setColorPatch(null);
                console.log("[Color picker] Convert to token:", color);
                if (page && selectedLayerIds.length > 0) {
                  const updatedLayers = page.layers.map((l) => {
                    if (selectedLayerIds.includes(l.id)) {
                      const patch = { fill: color, fills: [{ type: "solid" as const, color }] };
                      window.dispatchEvent(
                        new CustomEvent("codeclub:design-update-layer", {
                          detail: { layerId: l.id, patch },
                        }),
                      );
                      return { ...l, ...patch };
                    }
                    return l;
                  });
                  setPage({ ...page, layers: updatedLayers });
                }
              }, 150);
            }}
            style={{
              position: "absolute",
              inset: -10,
              width: 44,
              height: 44,
              opacity: 0,
              cursor: "pointer",
            }}
            title="Choose Color (Token)"
          />
        </div>
        <span style={{ width: 28, height: 1, background: "#303030", margin: "2px 0" }} />
        <div style={{ position: "relative" }}>
          <ToolbarButton
            label="Auto-layout"
            active={autoLayoutMenuVisible}
            activeColor={activeColor}
            onClick={() => {
              if (!autoLayoutMenuVisible) setExportMenuVisible(false);
              setAutoLayoutMenuVisible(!autoLayoutMenuVisible);
            }}
          >
            <rect x="4" y="6" width="16" height="12" rx="2" />
            <path d="M9 6v12M15 6v12" />
          </ToolbarButton>

          <div
            style={{
              position: "absolute",
              right: "100%",
              marginRight: 12,
              top: "50%",
              transform: `translate(${autoLayoutMenuVisible ? "0" : "20px"}, -50%)`,
              opacity: autoLayoutMenuVisible ? 1 : 0,
              pointerEvents: autoLayoutMenuVisible
                ? selectedLayerIds.length
                  ? "auto"
                  : "none"
                : "none",
              transition:
                "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease",
              background: "#1b1b1b",
              border: "1px solid #2b2b2b",
              borderRadius: 8,
              padding: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: 160,
              color: "#e0e0e0",
              fontSize: 12,
              zIndex: 10,
            }}
          >
            {!selectedLayerIds.length && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(27,27,27,0.7)",
                  borderRadius: 8,
                  zIndex: 5,
                }}
              />
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span style={{ fontWeight: 600 }}>Auto-layout</span>
            </div>

            <style>{`.al-dir-btn { transition: filter 0.15s ease; } .al-dir-btn:hover { filter: brightness(1.3); }`}</style>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="al-dir-btn"
                style={{
                  flex: 1,
                  padding: "4px 0",
                  background:
                    selectedLayer?.layoutMode === "horizontal"
                      ? activeColor || "#1597f5"
                      : "transparent",
                  border: "1px solid #333",
                  borderRadius: 4,
                  color: "#fff",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (!selectedLayer || !page) return;
                  const patch = { layoutMode: "horizontal" as const };
                  window.dispatchEvent(
                    new CustomEvent("codeclub:design-update-layer", {
                      detail: { layerId: selectedLayer.id, patch },
                    }),
                  );
                  setPage({
                    ...page,
                    layers: page.layers.map((l) =>
                      l.id === selectedLayer.id ? { ...l, ...patch } : l,
                    ),
                  });
                }}
              >
                →
              </button>
              <button
                className="al-dir-btn"
                style={{
                  flex: 1,
                  padding: "4px 0",
                  background:
                    selectedLayer?.layoutMode === "vertical"
                      ? activeColor || "#1597f5"
                      : "transparent",
                  border: "1px solid #333",
                  borderRadius: 4,
                  color: "#fff",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (!selectedLayer || !page) return;
                  const patch = { layoutMode: "vertical" as const };
                  window.dispatchEvent(
                    new CustomEvent("codeclub:design-update-layer", {
                      detail: { layerId: selectedLayer.id, patch },
                    }),
                  );
                  setPage({
                    ...page,
                    layers: page.layers.map((l) =>
                      l.id === selectedLayer.id ? { ...l, ...patch } : l,
                    ),
                  });
                }}
              >
                ↓
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <span>Gap</span>
              <input
                key={`gap-${selectedLayer?.id}-${selectedLayer?.layoutGap}`}
                type="text"
                inputMode="numeric"
                defaultValue={selectedLayer?.layoutGap ?? 0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  if (!selectedLayer || !page) return;
                  const patch = { layoutGap: parseInt(e.target.value) || 0 };
                  window.dispatchEvent(
                    new CustomEvent("codeclub:design-update-layer", {
                      detail: { layerId: selectedLayer.id, patch },
                    }),
                  );
                  setPage({
                    ...page,
                    layers: page.layers.map((l) =>
                      l.id === selectedLayer.id ? { ...l, ...patch } : l,
                    ),
                  });
                }}
                style={{
                  width: 40,
                  background: "#252525",
                  border: "1px solid #333",
                  borderRadius: 4,
                  color: "#fff",
                  padding: "2px 4px",
                  fontSize: 11,
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Pad H</span>
              <input
                key={`padH-${selectedLayer?.id}-${selectedLayer?.paddingLeft}`}
                type="text"
                inputMode="numeric"
                defaultValue={selectedLayer?.paddingLeft ?? 0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  if (!selectedLayer || !page) return;
                  const v = parseInt(e.target.value) || 0;
                  const patch = { paddingLeft: v, paddingRight: v };
                  window.dispatchEvent(
                    new CustomEvent("codeclub:design-update-layer", {
                      detail: { layerId: selectedLayer.id, patch },
                    }),
                  );
                  setPage({
                    ...page,
                    layers: page.layers.map((l) =>
                      l.id === selectedLayer.id ? { ...l, ...patch } : l,
                    ),
                  });
                }}
                style={{
                  width: 40,
                  background: "#252525",
                  border: "1px solid #333",
                  borderRadius: 4,
                  color: "#fff",
                  padding: "2px 4px",
                  fontSize: 11,
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Pad V</span>
              <input
                key={`padV-${selectedLayer?.id}-${selectedLayer?.paddingTop}`}
                type="text"
                inputMode="numeric"
                defaultValue={selectedLayer?.paddingTop ?? 0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  if (!selectedLayer || !page) return;
                  const v = parseInt(e.target.value) || 0;
                  const patch = { paddingTop: v, paddingBottom: v };
                  window.dispatchEvent(
                    new CustomEvent("codeclub:design-update-layer", {
                      detail: { layerId: selectedLayer.id, patch },
                    }),
                  );
                  setPage({
                    ...page,
                    layers: page.layers.map((l) =>
                      l.id === selectedLayer.id ? { ...l, ...patch } : l,
                    ),
                  });
                }}
                style={{
                  width: 40,
                  background: "#252525",
                  border: "1px solid #333",
                  borderRadius: 4,
                  color: "#fff",
                  padding: "2px 4px",
                  fontSize: 11,
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <ToolbarButton
            label="Export"
            active={exportMenuVisible}
            activeColor={activeColor}
            onClick={() => {
              if (!exportMenuVisible) setAutoLayoutMenuVisible(false);
              setExportMenuVisible(!exportMenuVisible);
            }}
          >
            <path d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5" />
            <path d="M5 18v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
          </ToolbarButton>

          <div
            style={{
              position: "absolute",
              right: "100%",
              marginRight: 12,
              top: "50%",
              transform: `translate(${exportMenuVisible ? "0" : "20px"}, -50%)`,
              opacity: exportMenuVisible ? 1 : 0,
              pointerEvents: exportMenuVisible
                ? selectedLayerIds.length
                  ? "auto"
                  : "none"
                : "none",
              transition:
                "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease",
              background: "#1b1b1b",
              border: "1px solid #2b2b2b",
              borderRadius: 8,
              padding: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              width: 170,
              color: "#e0e0e0",
              fontSize: 12,
              zIndex: 10,
            }}
          >
            {!selectedLayerIds.length && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(27,27,27,0.7)",
                  borderRadius: 8,
                  zIndex: 5,
                }}
              />
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 2,
              }}
            >
              <span style={{ fontWeight: 600 }}>Export</span>
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              {["PNG", "JSX", "TW"].map((fmt) => (
                <button
                  key={fmt}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    fontSize: 10,
                    fontWeight: 600,
                    background: exportFormat === fmt ? activeColor || "#1597f5" : "#252525",
                    border: "1px solid #333",
                    borderRadius: 4,
                    color: "#fff",
                    cursor: "pointer",
                    transition: "filter 0.15s ease",
                  }}
                  onClick={() => setExportFormat(fmt as any)}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                >
                  {fmt}
                </button>
              ))}
            </div>

            {exportFormat === "PNG" && (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 11, marginRight: 4 }}>Scale</span>
                {[1, 2, 3].map((scale) => (
                  <button
                    key={scale}
                    style={{
                      flex: 1,
                      padding: "2px 0",
                      fontSize: 10,
                      background: exportScale === scale ? "#3a3a3a" : "transparent",
                      border: "1px solid #333",
                      borderRadius: 4,
                      color: "#fff",
                      cursor: "pointer",
                    }}
                    onClick={() => setExportScale(scale as any)}
                  >
                    {scale}x
                  </button>
                ))}
              </div>
            )}

            <button
              style={{
                marginTop: 4,
                padding: "6px 0",
                background: "#fff",
                color: "#000",
                fontWeight: 600,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              onClick={() =>
                console.log(
                  `[Export] Triggering export for ${selectedLayerIds.join(", ")} | Format: ${exportFormat} | Scale: ${exportScale}x`,
                )
              }
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5" />
                <path d="M5 18v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
              </svg>
              Export {exportFormat}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShapeToolIcon({ tool }: { tool: ShapeTool }) {
  if (tool === "ellipse") return <ellipse cx="12" cy="12" rx="8" ry="7" />;
  if (tool === "triangle") return <path d="m12 4 9 16H3Z" />;
  return <rect x="4" y="5" width="16" height="14" rx="2" />;
}

function solidLayerFill(layer: DesignLayer) {
  return (
    layer.fills?.find((fill) => fill.visible !== false && fill.type === "solid")?.color ??
    layer.fill ??
    "#d9d9d9"
  );
}

function visibleStroke(layer: DesignLayer) {
  return layer.strokes?.find((stroke) => stroke.visible !== false && stroke.weight > 0);
}

function renderSvgLayer(layer: DesignLayer) {
  if (!layer.visible || layer.type === "group") return null;
  const x = Number.isFinite(layer.x) ? layer.x : 0;
  const y = Number.isFinite(layer.y) ? layer.y : 0;
  const width = Math.max(1, Number.isFinite(layer.width) ? layer.width : 1);
  const height = Math.max(1, Number.isFinite(layer.height) ? layer.height : 1);
  const layerOpacity =
    typeof layer.opacity === "number" ? Math.max(0, Math.min(1, layer.opacity)) : 1;
  const stroke = visibleStroke(layer);
  const strokeColor = stroke?.color ?? (layer.type === "frame" ? "#777777" : "transparent");
  const strokeWidth = stroke?.weight ?? (layer.type === "frame" ? 1 : 0);
  const fill =
    layer.type === "frame" || layer.type === "draw" ? "transparent" : solidLayerFill(layer);
  const common = {
    opacity: layerOpacity,
    fill,
    stroke: strokeColor,
    strokeWidth,
    vectorEffect: "non-scaling-stroke" as const,
  };

  if (layer.type === "ellipse") {
    return (
      <ellipse
        key={layer.id}
        {...common}
        cx={x + width / 2}
        cy={y + height / 2}
        rx={width / 2}
        ry={height / 2}
      />
    );
  }
  if (layer.type === "triangle") {
    return (
      <polygon
        key={layer.id}
        {...common}
        points={`${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`}
      />
    );
  }
  if (layer.type === "text") {
    return (
      <text
        key={layer.id}
        x={x}
        y={y + 16}
        fill={solidLayerFill(layer)}
        opacity={layerOpacity}
        fontSize={16}
      >
        {layer.text || "Text"}
      </text>
    );
  }
  if (layer.type === "draw") {
    return (
      <polyline
        key={layer.id}
        points={(layer.points ?? []).map((point) => `${x + point.x},${y + point.y}`).join(" ")}
        fill="none"
        stroke={stroke?.color ?? solidLayerFill(layer)}
        strokeWidth={stroke?.weight ?? 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={layerOpacity}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  return (
    <rect
      key={layer.id}
      {...common}
      x={x}
      y={y}
      width={width}
      height={height}
      rx={layer.cornerRadius ?? 0}
      ry={layer.cornerRadius ?? 0}
    />
  );
}

function renderSelectionOutline(layer: DesignLayer, activeColor?: string) {
  if (!layer.visible || layer.type === "group") return null;
  return (
    <rect
      key={`${layer.id}:selection`}
      x={layer.x}
      y={layer.y}
      width={Math.max(1, layer.width)}
      height={Math.max(1, layer.height)}
      fill="none"
      stroke={activeColor || "#1597f5"}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function resizeHandles(layer: DesignLayer): Array<{
  handle: ResizeHandle;
  x: number;
  y: number;
  cursor: string;
}> {
  const left = layer.x;
  const top = layer.y;
  const midX = layer.x + layer.width / 2;
  const midY = layer.y + layer.height / 2;
  const right = layer.x + layer.width;
  const bottom = layer.y + layer.height;
  return [
    { handle: "nw", x: left, y: top, cursor: "nwse-resize" },
    { handle: "n", x: midX, y: top, cursor: "ns-resize" },
    { handle: "ne", x: right, y: top, cursor: "nesw-resize" },
    { handle: "e", x: right, y: midY, cursor: "ew-resize" },
    { handle: "se", x: right, y: bottom, cursor: "nwse-resize" },
    { handle: "s", x: midX, y: bottom, cursor: "ns-resize" },
    { handle: "sw", x: left, y: bottom, cursor: "nesw-resize" },
    { handle: "w", x: left, y: midY, cursor: "ew-resize" },
  ];
}

const zoomButtonStyle = {
  width: 34,
  height: 34,
  padding: 0,
  border: 0,
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

function ToolbarButton({
  label,
  children,
  active = false,
  activeColor,
  onClick,
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  activeColor?: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        ...toolStyle,
        background: active ? activeColor || "#1597f5" : "transparent",
        color: active ? "#ffffff" : "#c7c7c7",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

const toolStyle = {
  width: 34,
  minWidth: 34,
  height: 34,
  padding: 0,
  border: 0,
  borderRadius: 5,
  background: "transparent",
  color: "#c7c7c7",
  cursor: "pointer",
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;
