import { useEffect, useState } from "react";
import CanvasKitInit, { CanvasKit, Surface, Paint, Path, Font, Canvas } from "canvaskit-wasm";
import canvaskitWasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";
import type { DesignLayer } from "../../../shared/design";
import RBush from "rbush";

interface RTreeItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
}

let ckPromise: Promise<CanvasKit> | null = null;
let globalCanvasKit: CanvasKit | null = null;

let activeRendererInstance: CanvasKitRenderer | null = null;
export function getActiveRenderer(): CanvasKitRenderer | null {
  return activeRendererInstance;
}

export function preloadCanvasKit() {
  if (!ckPromise) {
    ckPromise = CanvasKitInit({
      locateFile: (_file: string) => canvaskitWasmUrl,
    })
      .then((ck) => {
        globalCanvasKit = ck;
        return ck;
      })
      .catch((e) => {
        console.error("Error inicializando CanvasKit", e);
        throw e;
      });
  }
  return ckPromise;
}

function solidColor(layer: DesignLayer): string | null {
  const fill =
    layer.fills?.find((item) => item.visible !== false && item.type === "solid")?.color ??
    layer.fill;
  if (!fill || typeof fill !== "string") return null;
  if (fill.startsWith("$")) return null;
  return /^#[0-9a-fA-F]{6}$/.test(fill) ? fill : null;
}

function firstVisibleFill(layer: DesignLayer) {
  return layer.fills?.find((item) => item.visible !== false) ?? null;
}

interface LayerIndex {
  byId: Map<string, DesignLayer>;
  childrenByParent: Map<string | null, DesignLayer[]>;
}

function buildIndex(layers: DesignLayer[]): LayerIndex {
  const byId = new Map<string, DesignLayer>();
  const childrenByParent = new Map<string | null, DesignLayer[]>();
  for (const layer of layers) byId.set(layer.id, layer);
  for (const layer of layers) {
    const parentId = layer.parentId && byId.has(layer.parentId) ? layer.parentId : null;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(layer);
    childrenByParent.set(parentId, children);
  }
  return { byId, childrenByParent };
}

function clampOp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function rotX(x: number, y: number, cx: number, cy: number, angleDeg: number): number {
  const rad = (angleDeg * Math.PI) / 180;
  return (x - cx) * Math.cos(rad) - (y - cy) * Math.sin(rad) + cx;
}

function rotY(x: number, y: number, cx: number, cy: number, angleDeg: number): number {
  const rad = (angleDeg * Math.PI) / 180;
  return (x - cx) * Math.sin(rad) + (y - cy) * Math.cos(rad) + cy;
}

export class CanvasKitRenderer {
  private ck: CanvasKit;
  private surface: Surface | null = null;
  private layers: DesignLayer[] = [];
  private index: LayerIndex = { byId: new Map(), childrenByParent: new Map() };
  private defaultFont: Font | null = null;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private rtree = new RBush<RTreeItem>();
  private pathCache = new Map<string, Path>();

  constructor(private canvas: HTMLCanvasElement) {
    if (!globalCanvasKit) throw new Error("CanvasKit not loaded");
    this.ck = globalCanvasKit;
    this.surface = this.ck.MakeWebGLCanvasSurface(canvas);
    this.defaultFont = new this.ck.Font(null, 14);
    // eslint-disable-next-line no-this-alias
    activeRendererInstance = this;
  }

  sync_layers(layersJson: string) {
    try {
      this.layers = JSON.parse(layersJson);
      this.index = buildIndex(this.layers);
      this.clearPathCache();
      this.buildRTree();
    } catch (e) {
      console.error(e);
    }
  }

  private clearPathCache() {
    for (const path of this.pathCache.values()) path.delete();
    this.pathCache.clear();
  }

  private buildRTree() {
    this.rtree.clear();
    const items: RTreeItem[] = [];
    for (const layer of this.layers) {
      if (!layer.visible || layer.locked) continue;
      items.push({
        minX: layer.x,
        minY: layer.y,
        maxX: layer.x + layer.width,
        maxY: layer.y + layer.height,
        id: layer.id,
      });
    }
    this.rtree.load(items);
  }

  private getLayerPath(layer: DesignLayer, x: number, y: number): Path {
    let path: Path;
    if (layer.vectorPath) {
      const svgPath = this.ck.Path.MakeFromSVGString(layer.vectorPath);
      if (svgPath) {
        const builder = new this.ck.PathBuilder(svgPath);
        builder.offset(x, y);
        path = builder.detach();
        svgPath.delete();
      } else {
        path = new this.ck.Path();
      }
    } else if (layer.type === "ellipse") {
      const builder = new this.ck.PathBuilder();
      builder.addOval(this.ck.XYWHRect(x, y, layer.width, layer.height));
      path = builder.detach();
    } else if (layer.type === "triangle") {
      const builder = new this.ck.PathBuilder();
      builder.moveTo(x + layer.width / 2, y);
      builder.lineTo(x + layer.width, y + layer.height);
      builder.lineTo(x, y + layer.height);
      builder.close();
      path = builder.detach();
    } else {
      const rect = this.ck.XYWHRect(x, y, layer.width, layer.height);
      const builder = new this.ck.PathBuilder();
      if (layer.cornerRadius && layer.cornerRadius > 0) {
        const rrect = this.ck.RRectXY(rect, layer.cornerRadius, layer.cornerRadius);
        builder.addRRect(rrect);
      } else {
        builder.addRect(rect);
      }
      path = builder.detach();
    }
    if (layer.windingRule === "evenodd") {
      path.setFillType(this.ck.FillType.EvenOdd);
    }
    return path;
  }

  private getOrCachePath(layer: DesignLayer): Path | null {
    if (layer.type === "group") return null;
    if (layer.type === "text") {
      const builder = new this.ck.PathBuilder();
      builder.addRect(this.ck.XYWHRect(layer.x, layer.y, layer.width, layer.height));
      return builder.detach();
    }
    if (layer.type === "draw" && !layer.vectorPath && layer.points?.length) {
      const builder = new this.ck.PathBuilder();
      builder.moveTo(layer.x + layer.points[0].x, layer.y + layer.points[0].y);
      for (let i = 1; i < layer.points.length; i++) {
        builder.lineTo(layer.x + layer.points[i].x, layer.y + layer.points[i].y);
      }
      return builder.detach();
    }
    const cached = this.pathCache.get(layer.id);
    if (cached) return cached;
    const path = this.getLayerPath(layer, layer.x, layer.y);
    this.pathCache.set(layer.id, path);
    return path;
  }

  private isPointInsideAncestorClips(layer: DesignLayer, wx: number, wy: number): boolean {
    let parentId = layer.parentId;
    while (parentId) {
      const parent = this.index.byId.get(parentId);
      if (!parent) break;
      if (parent.clipsContent) {
        const clipPath = this.getOrCachePath(parent);
        if (clipPath && !clipPath.contains(wx, wy)) return false;
      }
      parentId = parent.parentId;
    }
    return true;
  }

  private hitTest(screenX: number, screenY: number): DesignLayer | null {
    const wx = (screenX - this.panX) / this.zoom;
    const wy = (screenY - this.panY) / this.zoom;

    const candidates = this.rtree.search({
      minX: wx,
      minY: wy,
      maxX: wx,
      maxY: wy,
    });

    candidates.sort((a, b) => {
      const za = this.layers.findIndex((l) => l.id === a.id);
      const zb = this.layers.findIndex((l) => l.id === b.id);
      return zb - za;
    });

    for (const item of candidates) {
      const layer = this.index.byId.get(item.id);
      if (!layer || layer.locked || !layer.visible || layer.type === "group") continue;

      let localX = wx;
      let localY = wy;
      if (layer.rotation) {
        const cx = layer.x + layer.width / 2;
        const cy = layer.y + layer.height / 2;
        localX = rotX(wx, wy, cx, cy, -layer.rotation);
        localY = rotY(wx, wy, cx, cy, -layer.rotation);
      }

      if (!this.isPointInsideAncestorClips(layer, wx, wy)) continue;

      if (
        layer.type === "text" ||
        (layer.type === "draw" && !layer.vectorPath && !layer.points?.length)
      ) {
        if (
          localX >= layer.x &&
          localX <= layer.x + layer.width &&
          localY >= layer.y &&
          localY <= layer.y + layer.height
        ) {
          return layer;
        }
        continue;
      }

      const path = this.getOrCachePath(layer);
      if (path && path.contains(localX, localY)) {
        return layer;
      }
    }

    return null;
  }

  computeBooleanOp(svgA: string, svgB: string, op: string): string | null {
    const pathA = this.ck.Path.MakeFromSVGString(svgA);
    const pathB = this.ck.Path.MakeFromSVGString(svgB);
    if (!pathA || !pathB) {
      if (pathA) pathA.delete();
      if (pathB) pathB.delete();
      return null;
    }
    const ckOp =
      op === "union"
        ? this.ck.PathOp.Union
        : op === "intersect"
          ? this.ck.PathOp.Intersect
          : op === "difference"
            ? this.ck.PathOp.Difference
            : op === "xor"
              ? this.ck.PathOp.XOR
              : this.ck.PathOp.Union;
    const result = this.ck.Path.MakeFromOp(pathA, pathB, ckOp);
    pathA.delete();
    pathB.delete();
    if (!result) return null;
    const svg = result.toSVGString();
    result.delete();
    return svg || null;
  }

  private applyFill(paint: Paint, layer: DesignLayer, x: number, y: number, opacity: number) {
    const fill = firstVisibleFill(layer);
    if (fill) {
      const fillOpacity = clampOp(fill.opacity ?? 1, 0, 1) * opacity;
      paint.setAlphaf(clampOp(fillOpacity, 0, 1));

      if (fill.type === "linear-gradient" && fill.stops?.length) {
        const colors = fill.stops.map((s) =>
          this.ck.Color(
            parseInt(s.color.slice(1, 3), 16) / 255,
            parseInt(s.color.slice(3, 5), 16) / 255,
            parseInt(s.color.slice(5, 7), 16) / 255,
            s.opacity ?? 1,
          ),
        );
        const positions = fill.stops.map((s) => s.position);
        const localMatrix = fill.transform
          ? [
              fill.transform[0],
              fill.transform[3],
              0,
              fill.transform[1],
              fill.transform[4],
              0,
              fill.transform[2],
              fill.transform[5],
              1,
            ]
          : undefined;
        const shader = this.ck.Shader.MakeLinearGradient(
          fill.transform ? [0, 0] : [x, y],
          fill.transform ? [1, 0] : [x + layer.width, y],
          colors,
          positions,
          this.ck.TileMode.Clamp,
          localMatrix,
        );
        paint.setShader(shader);
        return;
      }

      if (fill.type === "radial-gradient" && fill.stops?.length) {
        const colors = fill.stops.map((s) =>
          this.ck.Color(
            parseInt(s.color.slice(1, 3), 16) / 255,
            parseInt(s.color.slice(3, 5), 16) / 255,
            parseInt(s.color.slice(5, 7), 16) / 255,
            s.opacity ?? 1,
          ),
        );
        const positions = fill.stops.map((s) => s.position);
        const localMatrix = fill.transform
          ? [
              fill.transform[0],
              fill.transform[3],
              0,
              fill.transform[1],
              fill.transform[4],
              0,
              fill.transform[2],
              fill.transform[5],
              1,
            ]
          : undefined;
        const radius = fill.transform ? 0.5 : Math.max(layer.width, layer.height, 1) / 2;
        const shader = this.ck.Shader.MakeRadialGradient(
          fill.transform ? [0.5, 0.5] : [x + layer.width / 2, y + layer.height / 2],
          radius,
          colors,
          positions,
          this.ck.TileMode.Clamp,
          localMatrix,
        );
        paint.setShader(shader);
        return;
      }

      if (fill.type === "solid" && fill.color) {
        paint.setAlphaf(clampOp(fillOpacity, 0, 1));
        paint.setColor(this.ck.parseColorString(fill.color));
        paint.setShader(null);
        return;
      }
    }

    const color = solidColor(layer) ?? "#dddddd";
    paint.setAlphaf(clampOp(opacity, 0, 1));
    paint.setColor(this.ck.parseColorString(color));
    paint.setShader(null);
  }

  private applyStrokes(canvas: Canvas, layer: DesignLayer, opacity: number, path: Path) {
    const strokes = layer.strokes?.filter((s) => s.visible !== false && s.weight > 0) ?? [];
    const paint = new this.ck.Paint();
    paint.setStyle(this.ck.PaintStyle.Stroke);
    paint.setAntiAlias(true);

    if (strokes.length === 0 && (layer.type === "frame" || layer.type === "group")) {
      paint.setAlphaf(opacity);
      paint.setStrokeWidth(1);
      paint.setColor(this.ck.parseColorString("#777777"));
      canvas.drawPath(path, paint);
    } else {
      for (const stroke of strokes) {
        paint.setAlphaf(opacity * clampOp(stroke.opacity ?? 1, 0, 1));
        paint.setStrokeWidth(stroke.weight);
        paint.setColor(this.ck.parseColorString(stroke.color));
        canvas.drawPath(path, paint);
      }
    }
    paint.delete();
  }

  private drawLayer(canvas: Canvas, layer: DesignLayer, x: number, y: number, scale = 1) {
    if (!layer.visible || layer.type === "group") return;
    if (layer.width <= 0 && layer.height <= 0 && layer.type !== "draw") return;

    canvas.save();
    if (scale !== 1) {
      canvas.translate(x, y);
      canvas.scale(scale, scale);
      x = 0;
      y = 0;
    }
    if (scale === 1) this.applyAncestorClips(canvas, layer);

    const layerOpacity = clampOp(layer.opacity ?? 1, 0, 1);
    const cx = x + layer.width / 2;
    const cy = y + layer.height / 2;

    if (layer.rotation) {
      canvas.translate(cx, cy);
      canvas.rotate(layer.rotation, 0, 0);
      canvas.translate(-cx, -cy);
    }

    const blurEffect = layer.effects?.find(
      (e) => e.visible !== false && e.type === "layer-blur" && e.radius > 0,
    );
    if (blurEffect) {
      const blurFilter = this.ck.ImageFilter.MakeBlur(
        blurEffect.radius,
        blurEffect.radius,
        this.ck.TileMode.Clamp,
        null,
      );
      const savePaint = new this.ck.Paint();
      savePaint.setImageFilter(blurFilter);
      canvas.saveLayer(savePaint, undefined);
      savePaint.delete();
    }

    if (layer.type === "text") {
      this.drawText(canvas, layer, x, y, layerOpacity);
    } else if (layer.type === "draw") {
      this.drawFreehand(canvas, layer, x, y, layerOpacity);
    } else {
      const path = this.getLayerPath(layer, x, y);
      this.drawShape(canvas, layer, path, x, y, layerOpacity);
      path.delete();
    }

    if (blurEffect) {
      canvas.restore();
    }
    canvas.restore();
  }

  private drawShape(
    canvas: Canvas,
    layer: DesignLayer,
    path: Path,
    x: number,
    y: number,
    opacity: number,
  ) {
    const dropShadow = layer.effects?.find(
      (e) => e.visible !== false && e.type === "drop-shadow" && e.radius > 0,
    );

    if (dropShadow) {
      const shadowPaint = new this.ck.Paint();
      shadowPaint.setStyle(this.ck.PaintStyle.Fill);
      shadowPaint.setAntiAlias(true);
      shadowPaint.setAlphaf(opacity * clampOp(dropShadow.opacity ?? 1, 0, 1));
      shadowPaint.setColor(this.ck.parseColorString(dropShadow.color ?? "#000000"));
      const shadowFilter = this.ck.ImageFilter.MakeDropShadow(
        dropShadow.x ?? 0,
        dropShadow.y ?? 0,
        dropShadow.radius,
        dropShadow.radius,
        this.ck.parseColorString(dropShadow.color ?? "#000000"),
        null,
      );
      const shadowSavePaint = new this.ck.Paint();
      shadowSavePaint.setImageFilter(shadowFilter);
      canvas.saveLayer(shadowSavePaint, undefined);
      canvas.drawPath(path, shadowPaint);
      canvas.restore();
      shadowPaint.delete();
      shadowSavePaint.delete();
    }

    const fillPaint = new this.ck.Paint();
    fillPaint.setStyle(this.ck.PaintStyle.Fill);
    fillPaint.setAntiAlias(true);
    this.applyFill(fillPaint, layer, x, y, opacity);
    canvas.drawPath(path, fillPaint);

    const innerShadows =
      layer.effects?.filter(
        (e) => e.visible !== false && e.type === "inner-shadow" && e.radius > 0,
      ) ?? [];
    for (const is of innerShadows) {
      const isPaint = new this.ck.Paint();
      isPaint.setStyle(this.ck.PaintStyle.Stroke);
      isPaint.setAntiAlias(true);
      isPaint.setAlphaf(opacity * clampOp(is.opacity ?? 1, 0, 1));
      isPaint.setStrokeWidth(is.radius * 2);
      isPaint.setColor(this.ck.parseColorString(is.color ?? "#000000"));
      isPaint.setBlendMode(this.ck.BlendMode.SrcATop);
      canvas.drawPath(path, isPaint);
      isPaint.delete();
    }

    this.applyStrokes(canvas, layer, opacity, path);
    fillPaint.delete();
  }

  private drawText(canvas: Canvas, layer: DesignLayer, x: number, y: number, opacity: number) {
    if (!layer.text) return;
    const paint = new this.ck.Paint();
    paint.setStyle(this.ck.PaintStyle.Fill);
    paint.setAntiAlias(true);
    this.applyFill(paint, layer, x, y, opacity);

    if (!this.defaultFont) this.defaultFont = new this.ck.Font(null, 14);
    this.defaultFont.setSize(16);

    const dropShadow = layer.effects?.find(
      (e) => e.visible !== false && e.type === "drop-shadow" && e.radius > 0,
    );
    if (dropShadow) {
      canvas.save();
      const shadowFilter = this.ck.ImageFilter.MakeDropShadow(
        dropShadow.x ?? 0,
        dropShadow.y ?? 0,
        dropShadow.radius,
        dropShadow.radius,
        this.ck.parseColorString(dropShadow.color ?? "#000000"),
        null,
      );
      const savePaint = new this.ck.Paint();
      savePaint.setImageFilter(shadowFilter);
      canvas.saveLayer(savePaint, undefined);
      canvas.drawText(layer.text, x, y + 16, paint, this.defaultFont);
      canvas.restore();
      savePaint.delete();
      canvas.restore();
    } else {
      canvas.drawText(layer.text, x, y + 16, paint, this.defaultFont);
    }
    paint.delete();
  }

  private drawFreehand(canvas: Canvas, layer: DesignLayer, x: number, y: number, opacity: number) {
    if (layer.vectorPath) {
      const svgPath = this.ck.Path.MakeFromSVGString(layer.vectorPath);
      if (svgPath) {
        const fillPaint = new this.ck.Paint();
        fillPaint.setStyle(this.ck.PaintStyle.Fill);
        fillPaint.setAntiAlias(true);
        this.applyFill(fillPaint, layer, x, y, opacity);
        canvas.drawPath(svgPath, fillPaint);
        this.applyStrokes(canvas, layer, opacity, svgPath);
        fillPaint.delete();
        svgPath.delete();
      }
      return;
    }
    if (!layer.points?.length) return;
    const builder = new this.ck.PathBuilder();
    builder.moveTo(x + layer.points[0].x, y + layer.points[0].y);
    for (let i = 1; i < layer.points.length; i++) {
      builder.lineTo(x + layer.points[i].x, y + layer.points[i].y);
    }
    const path = builder.detach();

    const strokePaint = new this.ck.Paint();
    strokePaint.setStyle(this.ck.PaintStyle.Stroke);
    strokePaint.setAntiAlias(true);
    strokePaint.setAlphaf(opacity);

    const strokes = layer.strokes?.filter((s) => s.visible !== false && s.weight > 0) ?? [];
    if (strokes.length > 0) {
      const s = strokes[0];
      strokePaint.setAlphaf(opacity * clampOp(s.opacity ?? 1, 0, 1));
      strokePaint.setStrokeWidth(s.weight);
      strokePaint.setColor(this.ck.parseColorString(s.color));
    } else {
      strokePaint.setStrokeWidth(2);
      strokePaint.setColor(this.ck.parseColorString(solidColor(layer) ?? "#777777"));
    }
    canvas.drawPath(path, strokePaint);
    strokePaint.delete();
    path.delete();
  }

  private applyAncestorClips(canvas: Canvas, layer: DesignLayer) {
    const ancestors: DesignLayer[] = [];
    let parentId = layer.parentId;
    while (parentId) {
      const parent = this.index.byId.get(parentId);
      if (!parent) break;
      ancestors.push(parent);
      parentId = parent.parentId;
    }
    for (const ancestor of ancestors.reverse()) {
      if (ancestor.clipsContent) {
        const clipPath = this.getLayerPath(ancestor, ancestor.x, ancestor.y);
        canvas.clipPath(clipPath, this.ck.ClipOp.Intersect, true);
        clipPath.delete();
      }
    }
  }

  render(width: number, height: number, zoom: number, panX: number, panY: number) {
    if (!this.surface) return;

    this.zoom = zoom / 100;
    this.panX = panX;
    this.panY = panY;

    const canvas = this.surface.getCanvas();
    canvas.clear(this.ck.TRANSPARENT);

    const scale = zoom / 100;

    for (const layer of this.layers) {
      this.drawLayer(canvas, layer, panX + layer.x * scale, panY + layer.y * scale, scale);
    }

    this.surface.flush();
  }

  on_mouse_down(px: number, py: number): string | null {
    const hit = this.hitTest(px, py);
    return hit?.id ?? null;
  }

  on_mouse_move(_px: number, _py: number): string | null {
    return null;
  }

  on_mouse_up(): string | null {
    return null;
  }

  get_layer_patch(_id: string): string | null {
    return null;
  }

  free() {
    this.surface?.delete();
    this.defaultFont?.delete();
    this.clearPathCache();
  }

  exportPng(width: number, height: number): Uint8Array | null {
    if (!this.ck) return null;
    const surf = this.ck.MakeSurface(width, height);
    if (!surf) return null;
    try {
      const canvas = surf.getCanvas();
      canvas.clear(this.ck.TRANSPARENT);
      for (const layer of this.layers) {
        this.drawLayer(canvas, layer, layer.x, layer.y);
      }
      surf.flush();
      const img = surf.makeImageSnapshot();
      const bytes = img.encodeToBytes();
      img.delete();
      return bytes;
    } catch {
      return null;
    } finally {
      surf.delete();
    }
  }
}

export function useCanvasKitRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [renderer, setRenderer] = useState<CanvasKitRenderer | null>(null);
  const [isLoaded, setIsLoaded] = useState(!!globalCanvasKit);

  useEffect(() => {
    async function loadCK() {
      if (!canvasRef.current) return;
      try {
        await preloadCanvasKit();
        setIsLoaded(true);
        const instance = new CanvasKitRenderer(canvasRef.current);
        setRenderer(instance);
      } catch (e) {
        console.error("Error loading CanvasKit:", e);
      }
    }

    loadCK();

    return () => {
      // no cleanup here to avoid surface double-free in dev mode
    };
  }, [canvasRef]);

  return { renderer, isLoaded };
}
