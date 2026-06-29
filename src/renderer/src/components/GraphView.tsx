import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ArchitectureSummary, GraphData, ImpactResult } from "../../../preload/types";
import type { TopographicNode } from "../../../shared/topographicNodes";

// @ts-ignore - d3-force-3d has no TS types
import * as d3Force3d from "d3-force-3d";

const FILE_COLORS: Record<string, string> = {
  ts: "#c9b1ff",
  tsx: "#ffb3c6",
  js: "#ffe066",
  jsx: "#80cbc4",
  css: "#b3d9ff",
  md: "#ffcc80",
  json: "#b0bec5",
  py: "#a5d6a7",
  rs: "#ffab91",
  go: "#81d4fa",
  txt: "#94a3b8",
  html: "#fda4af",
  env: "#f59e0b",
  yaml: "#10b981",
  yml: "#10b981",
  root: "#60a5fa",
  dir: "#6b7280",
  function: "#67e8f9",
  class: "#c4b5fd",
  interface: "#f9a8d4",
  section: "#fdba74",
  block: "#94a3b8",
  other: "#64748b",
};

function getColor(kind: string, fileType: string): string {
  if (kind === "root") return "#60a5fa";
  if (kind === "dir") return "#6b7280";
  if (kind.startsWith("topo:")) return FILE_COLORS[kind.slice(5)] ?? FILE_COLORS.other;
  return FILE_COLORS[fileType] ?? "#b0bec5";
}

function composeGraph(
  data: GraphData,
  topographic: TopographicNode[],
  _expandedFiles: Set<string>,
): GraphData {
  const nodes: any[] = [];
  const edges: any[] = [...data.edges];

  // We use topographic as the structural base so ALL files/folders/symbols are visible.
  for (const node of topographic) {
    let kind: string = node.type;
    let id = node.id;
    
    // Match architecture graph IDs for files
    if (kind === "file") {
        id = node.path;
    } else if (kind === "workspace") {
        kind = "root";
        id = "root";
    } else if (kind === "folder") {
        kind = "dir";
    } else {
        kind = `topo:${kind}`;
        id = `topo:${node.id}`;
    }

    nodes.push({
        id,
        path: node.path,
        kind,
        fileType: node.language,
        size: Math.max(1, node.endLine - node.startLine + 1),
        name: node.name,
        startLine: node.startLine,
        endLine: node.endLine,
    });

    if (node.parentId) {
        const parent = topographic.find(p => p.id === node.parentId);
        if (parent) {
            let sourceId = parent.id;
            if (parent.type === "file") sourceId = parent.path;
            else if (parent.type === "workspace") sourceId = "root";
            else if (parent.type !== "folder") sourceId = `topo:${parent.id}`;
            
            edges.push({
                source: sourceId,
                target: id,
                structural: true
            });
        }
    }
  }

  // Preserve architecture properties (inDegree, etc.)
  for (const archNode of data.nodes) {
      if (archNode.kind === "file") {
          const topoFile = nodes.find(n => n.id === archNode.id);
          if (topoFile) {
              topoFile.inDegree = archNode.inDegree;
              topoFile.isCycleNode = archNode.isCycleNode;
          }
      }
  }

  return { nodes, edges };
}

const textureCache: Record<string, THREE.CanvasTexture> = {};

function makeSpriteTexture(color: string): THREE.CanvasTexture {
  if (textureCache[color]) return textureCache[color];

  const canvas = document.createElement("canvas");
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;

  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const br = Math.min(255, r + 50);
  const bg = Math.min(255, g + 50);
  const bb = Math.min(255, b + 50);

  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.2, `rgba(${br}, ${bg}, ${bb}, 1)`);
  gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.8)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  textureCache[color] = tex;
  return tex;
}

function buildNodes(data: GraphData, _workspacePath: string): any[] {
  const isInsideHiddenFolder = (path: string) => {
    if (!path) return false;
    const segments = path.replace(/\\/g, "/").split("/");
    return segments.slice(0, -1).some(seg => seg.startsWith(".") && seg !== ".");
  };

  const visibleNodes = data.nodes.filter(n => !isInsideHiddenFolder(n.path || ""));
  const fileNodes = visibleNodes.filter((n) => n.kind === "file");
  const maxSize = Math.max(...fileNodes.map((n) => n.size), 1);

  // Encontrar el umbral de in-degree para el top 10% de los módulos núcleo
  const inDegrees = fileNodes.map((n: any) => n.inDegree || 0).sort((a, b) => b - a);
  const coreThresholdIdx = Math.floor(inDegrees.length * 0.1);
  const coreThreshold = inDegrees.length > 0 ? Math.max(2, inDegrees[coreThresholdIdx]) : 999999;

  return visibleNodes.map((n: any) => {
    let val: number;
    if (n.kind === "root") val = 20;
    else if (n.kind === "dir") val = 5;
    else if (n.kind.startsWith("topo:")) val = 1.5;
    else val = Math.max(2, Math.sqrt(n.size / maxSize) * 10);

    // Evaluar si es un módulo núcleo o forma parte de un ciclo
    const isCore = n.kind === "file" && (n.inDegree || 0) >= coreThreshold;
    const isCycle = n.kind === "file" && !!n.isCycleNode;

    return {
      ...n,
      val,
      isCore,
      isCycle,
      fx: n.kind === "root" ? 0 : undefined,
      fy: n.kind === "root" ? 0 : undefined,
      fz: n.kind === "root" ? 0 : undefined,
    };
  });
}

function buildLinks(data: GraphData, nodeIds: Set<string>): any[] {
  return data.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e: any) => ({
      ...e,
      isCycle: !!e.isCycleEdge,
    }));
}

export function GraphView({
  workspacePath,
  onNodeClick,
  activeColor,
  onClose,
}: {
  workspacePath: string;
  onNodeClick?: (path: string) => void;
  activeColor?: string;
  onClose?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wsRef = useRef(workspacePath);
  const baseDataRef = useRef<GraphData | null>(null);
  const topographicRef = useRef<TopographicNode[]>([]);
  const expandedFilesRef = useRef(new Set<string>());
  const onNodeClickRef = useRef(onNodeClick);
  const [architecture, setArchitecture] = useState<ArchitectureSummary | null>(null);
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  wsRef.current = workspacePath;
  onNodeClickRef.current = onNodeClick;

  useEffect(() => {
    if (!workspacePath) return;
    let destroyed = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      try {
        const [baseData, topographic] = await Promise.all([
          window.api.getGraphEdges(workspacePath),
          window.api.topographicTree(workspacePath),
        ]);
        baseDataRef.current = baseData;
        topographicRef.current = topographic;
        const data = composeGraph(baseData, topographic, expandedFilesRef.current);
        if (destroyed || !data.nodes.length) return;

        const mod = await import("3d-force-graph");
        const FG = mod.default;
        if (destroyed) return;

        const wsName = workspacePath.split("\\").pop() || workspacePath.split("/").pop() || "";
        const nodes = buildNodes(data, workspacePath);
        const nodeIds = new Set(nodes.map((n) => n.id));
        const links = buildLinks(data, nodeIds);

        const container = containerRef.current;
        if (!container || destroyed) return;

        const g = new FG(container, { controlType: "orbit" });
        graphRef.current = g;

        const controls = g.controls() as any;
        if (controls) {
          controls.enablePan = false;
          controls.enableZoom = false;
          controls.mouseButtons = {
            LEFT: null as any,
            MIDDLE: -1,
            RIGHT: THREE.MOUSE.ROTATE,
          };
        }
        g.enableNodeDrag(false);

        ro = new ResizeObserver((entries) => {
          for (let entry of entries) {
            const { width, height } = entry.contentRect;
            g.width(width);
            g.height(height);
          }
        });
        ro.observe(container);

        g.graphData({ nodes, links });
        g.nodeThreeObject((node: any) => {
          let color = getColor(node.kind, node.fileType);

          // Resaltados topológicos interactivos
          if (node.isCycle) {
            color = "#ef4444"; // Rojo vibrante estándar
          } else if (node.isCore) {
            color = "#a855f7"; // Púrpura vibrante estándar
          }

          const tex = makeSpriteTexture(color);

          // Escalar nodos basado en inDegree (conexiones entrantes de dependencias locales)
          // Nodos pesados o muy conectados escalan dinámicamente su radio
          const connScale = Math.min(3, 1 + (node.inDegree || 0) * 0.15);
          const radius = Math.cbrt(10 * (node.val || 1)) * connScale;

          // Aplicar escala visual imponente a los núcleos y nodos altamente conectados
          const scaleMultiplier = node.isCore ? 3.5 : 2.2;

          const mat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
            opacity: 1,
          });
          const sprite = new THREE.Sprite(mat);
          sprite.scale.set(radius * scaleMultiplier, radius * scaleMultiplier, 1);

          // Almacenar el radio final calculado para usarlo en la fuerza de colisión
          node.__computedRadius = radius * scaleMultiplier;

          return sprite;
        });
        g.nodeRelSize(10);
        g.nodeVal("val");
        g.showNavInfo(false);
        g.linkColor((d: any) => {
          if (d.isCycle) return "rgba(239, 68, 68, 0.85)"; // Aristas de ciclos rojo vivo
          if (d.source?.kind === "root" || d.target?.kind === "root")
            return "rgba(59, 130, 246, 0.35)";
          if (d.source?.kind === "dir" || d.target?.kind === "dir")
            return "rgba(107, 114, 128, 0.35)";
          return "rgba(148, 163, 184, 0.55)";
        });
        g.linkWidth((d: any) => {
          if (d.isCycle) return 3.5; // Aristas de ciclos más gruesas
          if (d.source?.kind === "root") return 2.5;
          return 1.5;
        });
        g.backgroundColor(
          getComputedStyle(document.documentElement).getPropertyValue("--background-base").trim() ||
            "#1a1b26",
        );
        g.d3AlphaDecay(0.02);
        g.d3VelocityDecay(0.3);
        g.warmupTicks(100);
        g.cooldownTicks(0);
        g.nodeLabel((d: any) => {
          if (d.kind === "root") return wsName;
          if (d.kind === "dir") return (d.id as string).replace(/\/$/, "").split("/").pop() || d.id;
          if (d.kind.startsWith("topo:"))
            return `${d.name} · ${d.kind.slice(5)} · L${d.startLine}-${d.endLine}`;
          const parts = d.path.replace(/\\/g, "/").split("/");
          const baseName = parts[parts.length - 1] || d.id;
          return `${baseName} (Imports: ${d.inDegree || 0})`;
        });
        g.onNodeClick((d: any) => {
          if (d?.path && d.kind !== "root" && d.kind !== "dir") {
            onNodeClickRef.current?.(d.path);
            window.api
              .indexingImpact(wsRef.current, d.path)
              .then(setImpact)
              .catch(() => setImpact(null));
          }
        });
        g.onNodeRightClick((d: any) => {
          if (d?.kind !== "file" || !d.path || !baseDataRef.current) return;
          const expanded = expandedFilesRef.current;
          if (expanded.has(d.path)) expanded.delete(d.path);
          else expanded.add(d.path);
          const next = composeGraph(baseDataRef.current, topographicRef.current, expanded);
          const nextNodes = buildNodes(next, workspacePath);
          g.graphData({
            nodes: nextNodes,
            links: buildLinks(next, new Set(nextNodes.map((node: any) => node.id))),
          });
          g.d3ReheatSimulation();
        });
        g.onNodeHover((d: any) => {
          container.style.cursor =
            d && (d.kind === "file" || d.kind?.startsWith("topo:")) ? "pointer" : "default";
        });
        if (links.length > 0) {
          g.d3Force("link")?.distance((d: any) => {
            if (d.source?.kind === "root") return 220;
            if (d.source?.kind === "dir") return 120;
            return 90;
          });
        }
        // Fuerza de colisión dinámica basada en el tamaño calculado del nodo para empujar
        // y evitar solapamientos visuales (clipping)
        g.d3Force(
          "collision",
          (d3Force3d as any).forceCollide((node: any) => {
            return (node.__computedRadius || 5) + 6;
          }),
        );
        g.d3Force("charge")?.strength((node: any) => {
          // Repeler más fuerte a los nodos pesados
          return node.kind === "root" ? -1000 : -250 - (node.inDegree || 0) * 120;
        });
        g.d3ReheatSimulation();
        g.cameraPosition({ x: 0, y: 0, z: 350 }, { x: 0, y: 0, z: 0 });
      } catch (err: any) {
        console.error("GraphView error:", err);
      }
    })();

    window.api
      .indexingArchitecture(workspacePath)
      .then((summary) => {
        if (!destroyed) setArchitecture(summary);
      })
      .catch(() => {});

    return () => {
      destroyed = true;
      if (ro) ro.disconnect();
      if (graphRef.current) {
        if (typeof graphRef.current._destructor === "function") {
          graphRef.current._destructor();
        }
      }
      graphRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [workspacePath]);

  useEffect(() => {
    if (!workspacePath) return;
    const ws = workspacePath.replace(/\\/g, "/");
    const unlisten = window.api.onFsChange((dirPath, _filename) => {
      const changed = dirPath.replace(/\\/g, "/");
      if (!changed.startsWith(ws)) return;
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        const g = graphRef.current;
        if (!g) return;
        const [baseData, topographic] = await Promise.all([
          window.api.getGraphEdges(wsRef.current),
          window.api.topographicTree(wsRef.current),
        ]);
        baseDataRef.current = baseData;
        topographicRef.current = topographic;
        const data = composeGraph(baseData, topographic, expandedFilesRef.current);
        const nodes = buildNodes(data, wsRef.current);
        const nodeIds = new Set(nodes.map((n) => n.id));
        const links = buildLinks(data, nodeIds);
        g.graphData({ nodes, links });
        g.d3ReheatSimulation();
      }, 500);
    });
    return () => {
      unlisten();
      clearTimeout(timeoutRef.current);
    };
  }, [workspacePath]);

  const [isFreeMovement, setIsFreeMovement] = useState(false);
  const isFreeMovementRef = useRef(false);
  isFreeMovementRef.current = isFreeMovement;

  const speedRef = useRef(4);

  useEffect(() => {
    const activeKeys = new Set<string>();
    let animationFrameId: number;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "escape") {
        setIsFreeMovement(false);
        return;
      }

      if (!isFreeMovementRef.current) return;

      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "control"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
      activeKeys.add(key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      activeKeys.delete(key);
    };

    const handleWheel = (e: WheelEvent) => {
      if (!isFreeMovementRef.current) return;
      e.preventDefault();

      // Aumentar/Disminuir velocidad con la ruedita
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      const nextSpeed = speedRef.current * factor;
      speedRef.current = Math.min(25, Math.max(0.5, nextSpeed));
    };

    const updateMovement = () => {
      const g = graphRef.current;
      if (isFreeMovementRef.current && g) {
        const camera = g.camera();
        const controls = g.controls();
        if (camera && controls) {
          const speed = speedRef.current;
          const direction = new THREE.Vector3();
          camera.getWorldDirection(direction);

          const side = new THREE.Vector3();
          side.crossVectors(direction, camera.up).normalize();

          let moved = false;

          if (activeKeys.has("w") || activeKeys.has("arrowup")) {
            camera.position.addScaledVector(direction, speed);
            controls.target.addScaledVector(direction, speed);
            moved = true;
          }
          if (activeKeys.has("s") || activeKeys.has("arrowdown")) {
            camera.position.addScaledVector(direction, -speed);
            controls.target.addScaledVector(direction, -speed);
            moved = true;
          }
          if (activeKeys.has("a") || activeKeys.has("arrowleft")) {
            camera.position.addScaledVector(side, -speed);
            controls.target.addScaledVector(side, -speed);
            moved = true;
          }
          if (activeKeys.has("d") || activeKeys.has("arrowright")) {
            camera.position.addScaledVector(side, speed);
            controls.target.addScaledVector(side, speed);
            moved = true;
          }
          if (activeKeys.has(" ")) {
            camera.position.y += speed;
            controls.target.y += speed;
            moved = true;
          }
          if (activeKeys.has("control")) {
            camera.position.y -= speed;
            controls.target.y -= speed;
            moved = true;
          }

          if (moved) {
            controls.update();
          }
        }
      }
      animationFrameId = requestAnimationFrame(updateMovement);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    containerRef.current?.addEventListener("wheel", handleWheel, { passive: false });
    animationFrameId = requestAnimationFrame(updateMovement);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      containerRef.current?.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#111111",
        color: "var(--text-strong)",
      }}
    >
      {/* Sleek Top Bar */}
      {onClose && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "6px 12px",
            borderBottom: "1px solid var(--border-weaker-base)",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            title="Back"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--icon-base)",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span
            style={{
              fontSize: "var(--font-size-small)",
              color: "var(--text-strong)",
              fontWeight: 500,
            }}
          >
            Graph View
          </span>
        </div>
      )}

      {/* Architecture Strip Removed */}

      {/* Graph Container */}
      <div
        ref={containerRef}
        onClick={() => setIsFreeMovement(true)}
        style={{
          flex: 1,
          width: "100%",
          position: "relative",
          overflow: "hidden",
          cursor: "default",
          border: isFreeMovement
            ? `2px solid ${activeColor || "rgba(96, 165, 250, 0.8)"}`
            : "2px solid transparent",
          boxSizing: "border-box",
          transition: "border 0.2s ease-in-out",
        }}
      >
        {impact && <GraphImpactOverlay impact={impact} />}
      </div>
    </div>
  );
}

function GraphMetric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: "6px 8px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </div>
      <div style={{ color: "var(--text-strong)", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function GraphArchitectureStrip({ architecture }: { architecture: ArchitectureSummary }) {
  const topHotspots = architecture.hotspots.slice(0, 3);
  const topRoutes = architecture.routes.slice(0, 3);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr)) 1.6fr 1.6fr",
        gap: 8,
        padding: "8px 12px",
        borderBottom: "1px solid var(--border-weaker-base)",
        flexShrink: 0,
        fontSize: 11,
      }}
    >
      <GraphMetric label="Files" value={architecture.totalFiles} />
      <GraphMetric label="Chunks" value={architecture.totalChunks} />
      <GraphMetric label="Edges" value={architecture.totalEdges} />
      <GraphMetric label="Routes" value={architecture.routes.length} />
      <GraphList label="Hotspots" items={topHotspots.map((item) => item.path)} />
      <GraphList label="Routes" items={topRoutes.map((item) => item.name)} />
    </div>
  );
}

function GraphList({ label, items }: { label: string; items: string[] }) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: "6px 8px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ display: "grid", gap: 2 }}>
        {(items.length ? items : ["None"]).map((item, index) => (
          <div
            key={`${item}-${index}`}
            title={item}
            style={{
              color: "var(--text-strong)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphImpactOverlay({ impact }: { impact: ImpactResult }) {
  const affected = impact.direct.slice(0, 5);
  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 12,
        width: "min(520px, calc(100% - 24px))",
        padding: 10,
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 6,
        background: "rgba(17,17,17,0.92)",
        fontSize: 12,
        pointerEvents: "none",
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Impact</div>
      <div
        title={impact.targetFile ?? impact.target}
        style={{
          color: "var(--text-strong)",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {impact.targetFile ?? impact.target}
      </div>
      <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
        {impact.direct.length} direct, {impact.transitive.length} transitive
      </div>
      {affected.length > 0 && <GraphList label="Direct" items={affected} />}
    </div>
  );
}
