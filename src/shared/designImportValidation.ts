import type { DesignEffect, DesignFill, DesignLayer, DesignPage, DesignStroke } from "./design";

const LAYER_TYPES = new Set<DesignLayer["type"]>([
  "group",
  "frame",
  "rectangle",
  "ellipse",
  "triangle",
  "text",
  "draw",
]);

export interface DesignImportValidationResult {
  page: DesignPage;
  warnings: string[];
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeId(value: unknown, fallback: string): string {
  const raw = String(value || fallback).trim();
  return raw.replace(/[^a-zA-Z0-9_-]/g, "-") || fallback;
}

function safeColor(value: unknown, fallback: string): string {
  if (value === "transparent") return value;
  if (typeof value === "string") {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
    if (/^\$[a-zA-Z][a-zA-Z0-9_.-]*$/.test(value)) return value;
  }
  return fallback;
}

function normalizeFills(value: unknown): DesignFill[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const fills = value
    .filter(
      (fill) =>
        fill?.type === "solid" ||
        fill?.type === "linear-gradient" ||
        fill?.type === "radial-gradient",
    )
    .map(
      (fill): DesignFill => ({
        type: fill.type,
        color: fill.type === "solid" ? safeColor(fill.color, "#d9d9d9") : undefined,
        stops: Array.isArray(fill.stops)
          ? fill.stops.map((stop: any) => ({
              color: safeColor(stop?.color, "#d9d9d9"),
              position: Math.max(0, Math.min(1, finiteNumber(stop?.position))),
              opacity:
                typeof stop?.opacity === "number"
                  ? Math.max(0, Math.min(1, stop.opacity))
                  : undefined,
            }))
          : undefined,
        opacity:
          typeof fill.opacity === "number" ? Math.max(0, Math.min(1, fill.opacity)) : undefined,
        visible: fill.visible !== false,
        transform:
          Array.isArray(fill.transform) &&
          fill.transform.length === 6 &&
          fill.transform.every((v: any) => typeof v === "number" && Number.isFinite(v))
            ? (fill.transform as number[])
            : undefined,
      }),
    )
    .filter((fill) => fill.type === "solid" || (fill.stops?.length ?? 0) > 0);
  return fills.length ? fills : undefined;
}

function normalizeStrokes(value: unknown): DesignStroke[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strokes = value
    .filter((stroke) => stroke?.color)
    .map(
      (stroke): DesignStroke => ({
        color: safeColor(stroke.color, "#777777"),
        weight: Math.max(0, finiteNumber(stroke.weight, 1)),
        opacity:
          typeof stroke.opacity === "number" ? Math.max(0, Math.min(1, stroke.opacity)) : undefined,
        visible: stroke.visible !== false,
        align: stroke.align === "outside" || stroke.align === "center" ? stroke.align : "inside",
      }),
    )
    .filter((stroke) => stroke.weight > 0);
  return strokes.length ? strokes : undefined;
}

function normalizeEffects(value: unknown): DesignEffect[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const effects = value
    .filter(
      (effect) =>
        effect?.type === "drop-shadow" ||
        effect?.type === "inner-shadow" ||
        effect?.type === "layer-blur",
    )
    .map(
      (effect): DesignEffect => ({
        type: effect.type,
        color: safeColor(effect.color, "#000000"),
        x: finiteNumber(effect.x),
        y: finiteNumber(effect.y),
        radius: Math.max(0, finiteNumber(effect.radius)),
        opacity:
          typeof effect.opacity === "number" ? Math.max(0, Math.min(1, effect.opacity)) : undefined,
        visible: effect.visible !== false,
      }),
    )
    .filter((effect) => effect.radius > 0);
  return effects.length ? effects : undefined;
}

function normalizeLayoutMode(value: unknown): DesignLayer["layoutMode"] | undefined {
  return value === "horizontal" || value === "vertical" || value === "none" ? value : undefined;
}

function normalizeLayoutAlign(value: unknown): DesignLayer["layoutAlign"] | undefined {
  return value === "start" || value === "center" || value === "end" || value === "space-between"
    ? value
    : undefined;
}

function normalizeLayoutCrossAlign(value: unknown): DesignLayer["layoutCrossAlign"] | undefined {
  return value === "start" || value === "center" || value === "end" || value === "stretch"
    ? value
    : undefined;
}

function normalizeComponentRole(value: unknown): DesignLayer["componentRole"] | undefined {
  return value === "component" || value === "instance" || value === "component-set"
    ? value
    : undefined;
}

function normalizeVariantProperties(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(
      ([, item]) =>
        typeof item === "string" || typeof item === "number" || typeof item === "boolean",
    )
    .map(([key, item]) => [safeId(key, "variant"), String(item)] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function normalizeDesignImportPage(
  input: DesignPage,
  fallbackName: string,
): DesignImportValidationResult {
  if (!input || !Array.isArray(input.layers)) {
    throw new Error("El archivo no tiene formato de pagina Design compatible.");
  }

  const warnings: string[] = [];
  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();
  const layers: DesignLayer[] = [];

  input.layers.forEach((rawLayer: any, index) => {
    const type = rawLayer?.type;
    if (!LAYER_TYPES.has(type)) {
      warnings.push(`Layer ignorado por tipo no soportado: ${type || "unknown"}.`);
      return;
    }

    const originalId = String(rawLayer?.id || `layer-${index}`);
    let id = safeId(originalId, `layer-${index}`);
    while (usedIds.has(id)) {
      id = `${id}-${index}`;
      warnings.push(`ID duplicado normalizado: ${originalId}.`);
    }
    usedIds.add(id);
    idMap.set(originalId, id);

    const fills = normalizeFills(rawLayer.fills);
    const firstSolid = fills?.find((item) => item.type === "solid" && item.color);
    const fill = safeColor(
      rawLayer.fill,
      firstSolid?.color ?? (type === "text" || type === "draw" ? "#f4f4f5" : "#d9d9d9"),
    );

    layers.push({
      id,
      name: String(rawLayer.name || type),
      type,
      parentId: rawLayer.parentId ? String(rawLayer.parentId) : null,
      visible: rawLayer.visible !== false,
      locked: Boolean(rawLayer.locked),
      x: finiteNumber(rawLayer.x),
      y: finiteNumber(rawLayer.y),
      width: Math.max(0, finiteNumber(rawLayer.width)),
      height: Math.max(0, finiteNumber(rawLayer.height)),
      fill,
      fills,
      strokes: normalizeStrokes(rawLayer.strokes),
      effects: normalizeEffects(rawLayer.effects),
      opacity:
        typeof rawLayer.opacity === "number"
          ? Math.max(0, Math.min(1, rawLayer.opacity))
          : undefined,
      rotation: finiteNumber(rawLayer.rotation, 0) || undefined,
      cornerRadius:
        typeof rawLayer.cornerRadius === "number" ? Math.max(0, rawLayer.cornerRadius) : undefined,
      layoutMode: normalizeLayoutMode(rawLayer.layoutMode),
      layoutGap:
        typeof rawLayer.layoutGap === "number" ? Math.max(0, rawLayer.layoutGap) : undefined,
      paddingTop:
        typeof rawLayer.paddingTop === "number" ? Math.max(0, rawLayer.paddingTop) : undefined,
      paddingRight:
        typeof rawLayer.paddingRight === "number" ? Math.max(0, rawLayer.paddingRight) : undefined,
      paddingBottom:
        typeof rawLayer.paddingBottom === "number"
          ? Math.max(0, rawLayer.paddingBottom)
          : undefined,
      paddingLeft:
        typeof rawLayer.paddingLeft === "number" ? Math.max(0, rawLayer.paddingLeft) : undefined,
      layoutAlign: normalizeLayoutAlign(rawLayer.layoutAlign),
      layoutCrossAlign: normalizeLayoutCrossAlign(rawLayer.layoutCrossAlign),
      layoutGrow:
        typeof rawLayer.layoutGrow === "number" ? Math.max(0, rawLayer.layoutGrow) : undefined,
      layoutWrap:
        rawLayer.layoutWrap === "wrap" || rawLayer.layoutWrap === "nowrap"
          ? rawLayer.layoutWrap
          : undefined,
      minWidth: typeof rawLayer.minWidth === "number" ? Math.max(0, rawLayer.minWidth) : undefined,
      maxWidth: typeof rawLayer.maxWidth === "number" ? Math.max(0, rawLayer.maxWidth) : undefined,
      minHeight:
        typeof rawLayer.minHeight === "number" ? Math.max(0, rawLayer.minHeight) : undefined,
      maxHeight:
        typeof rawLayer.maxHeight === "number" ? Math.max(0, rawLayer.maxHeight) : undefined,
      componentRole: normalizeComponentRole(rawLayer.componentRole),
      componentId: rawLayer.componentId ? safeId(rawLayer.componentId, "component") : undefined,
      instanceOf: rawLayer.instanceOf ? safeId(rawLayer.instanceOf, "component") : undefined,
      variantProperties: normalizeVariantProperties(rawLayer.variantProperties),
      isDetachedInstance: Boolean(rawLayer.isDetachedInstance),
      clipsContent: Boolean(rawLayer.clipsContent),
      vectorPath: typeof rawLayer.vectorPath === "string" ? rawLayer.vectorPath : undefined,
      windingRule:
        rawLayer.windingRule === "evenodd"
          ? "evenodd"
          : rawLayer.windingRule === "nonzero"
            ? "nonzero"
            : undefined,
      text: type === "text" ? String(rawLayer.text ?? "") : undefined,
      points: Array.isArray(rawLayer.points)
        ? rawLayer.points.map((point: any) => ({
            x: finiteNumber(point?.x),
            y: finiteNumber(point?.y),
          }))
        : undefined,
    });
  });

  const validIds = new Set(layers.map((layer) => layer.id));
  for (const layer of layers) {
    if (!layer.parentId) continue;
    const mappedParent = idMap.get(layer.parentId) ?? layer.parentId;
    if (validIds.has(mappedParent) && mappedParent !== layer.id) layer.parentId = mappedParent;
    else {
      warnings.push(`Parent invalido corregido en layer: ${layer.name}.`);
      layer.parentId = null;
    }
  }

  const componentIds = new Set(
    layers
      .filter(
        (layer) => layer.componentRole === "component" || layer.componentRole === "component-set",
      )
      .map((layer) => layer.componentId || layer.id),
  );
  for (const layer of layers) {
    if (layer.componentRole !== "instance") continue;
    if (!layer.instanceOf || !componentIds.has(layer.instanceOf)) layer.isDetachedInstance = true;
  }

  if (!layers.length) throw new Error("No se encontraron layers importables.");

  return {
    page: {
      version: 1,
      id: safeId(input.id, `import-${Date.now()}`),
      name: String(input.name || fallbackName || "Imported Design"),
      layers,
    },
    warnings,
  };
}
