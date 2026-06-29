import type { DesignLayer } from "./design";

export interface DesignLayerIndex {
  byId: Map<string, DesignLayer>;
  childrenByParent: Map<string | null, DesignLayer[]>;
}

export function buildDesignLayerIndex(layers: DesignLayer[]): DesignLayerIndex {
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

export function getDesignLayerDescendantIds(layers: DesignLayer[], layerId: string): Set<string> {
  const index = buildDesignLayerIndex(layers);
  const ids = new Set<string>();
  const visit = (id: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    for (const child of index.childrenByParent.get(id) ?? []) visit(child.id);
  };
  visit(layerId);
  return ids;
}

export async function absolutizeDesignLayers(layers: DesignLayer[]): Promise<DesignLayer[]> {
  const { computeAutoLayoutLayers } = await import("./designAutoLayout");
  const laidOutLayers = await computeAutoLayoutLayers(layers);
  const index = buildDesignLayerIndex(laidOutLayers);
  const cache = new Map<string, { x: number; y: number }>();
  const absolutePosition = (layer: DesignLayer): { x: number; y: number } => {
    const cached = cache.get(layer.id);
    if (cached) return cached;
    const parent = layer.parentId ? index.byId.get(layer.parentId) : null;
    const parentPosition = parent ? absolutePosition(parent) : { x: 0, y: 0 };
    const position = { x: parentPosition.x + layer.x, y: parentPosition.y + layer.y };
    cache.set(layer.id, position);
    return position;
  };

  return laidOutLayers.map((layer) => {
    const position = absolutePosition(layer);
    const visibleFill = layer.fills?.find(
      (fill) => fill.visible !== false && fill.type === "solid",
    );
    return { ...layer, x: position.x, y: position.y, fill: visibleFill?.color ?? layer.fill };
  });
}
