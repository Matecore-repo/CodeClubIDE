import type { DesignLayer } from "./design";
import { buildDesignLayerIndex } from "./designLayers";

type YogaAPI = typeof import("yoga-layout").default;

let _Yoga: YogaAPI | null = null;
let _yogaErr = false;

async function getYoga(): Promise<YogaAPI | null> {
  if (_Yoga) return _Yoga;
  if (_yogaErr) return null;
  try {
    const mod = await import("yoga-layout");
    _Yoga = mod.default;
    return _Yoga;
  } catch {
    _yogaErr = true;
    return null;
  }
}

function justifyContent(value: DesignLayer["layoutAlign"], Yoga: YogaAPI) {
  if (value === "center") return Yoga.JUSTIFY_CENTER;
  if (value === "end") return Yoga.JUSTIFY_FLEX_END;
  if (value === "space-between") return Yoga.JUSTIFY_SPACE_BETWEEN;
  return Yoga.JUSTIFY_FLEX_START;
}

function alignItems(value: DesignLayer["layoutCrossAlign"], Yoga: YogaAPI) {
  if (value === "center") return Yoga.ALIGN_CENTER;
  if (value === "end") return Yoga.ALIGN_FLEX_END;
  if (value === "stretch") return Yoga.ALIGN_STRETCH;
  return Yoga.ALIGN_FLEX_START;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function computeAutoLayoutLayers(layers: DesignLayer[]): Promise<DesignLayer[]> {
  const Yoga = await getYoga();
  if (!Yoga) return layers;
  const index = buildDesignLayerIndex(layers);
  const patches = new Map<string, { x: number; y: number; width?: number; height?: number }>();

  for (const parent of layers) {
    if (parent.layoutMode !== "horizontal" && parent.layoutMode !== "vertical") continue;
    if (parent.type !== "frame" && parent.type !== "group") continue;
    const children = index.childrenByParent.get(parent.id) ?? [];
    if (!children.length) continue;

    try {
      const root = Yoga.Node.create();
      root.setWidth(Math.max(0, finite(parent.width)));
      root.setHeight(Math.max(0, finite(parent.height)));
      root.setFlexDirection(
        parent.layoutMode === "horizontal" ? Yoga.FLEX_DIRECTION_ROW : Yoga.FLEX_DIRECTION_COLUMN,
      );
      root.setJustifyContent(justifyContent(parent.layoutAlign, Yoga));
      root.setAlignItems(alignItems(parent.layoutCrossAlign, Yoga));
      root.setPadding(Yoga.EDGE_TOP, Math.max(0, finite(parent.paddingTop)));
      root.setPadding(Yoga.EDGE_RIGHT, Math.max(0, finite(parent.paddingRight)));
      root.setPadding(Yoga.EDGE_BOTTOM, Math.max(0, finite(parent.paddingBottom)));
      root.setPadding(Yoga.EDGE_LEFT, Math.max(0, finite(parent.paddingLeft)));
      if (parent.layoutGap) root.setGap(Yoga.GUTTER_ALL, Math.max(0, parent.layoutGap));
      if (parent.layoutWrap === "wrap") {
        root.setFlexWrap(Yoga.WRAP_WRAP);
      }

      const childNodes = children.map((child) => {
        const node = Yoga.Node.create();
        node.setWidth(Math.max(0, finite(child.width)));
        node.setHeight(Math.max(0, finite(child.height)));

        if (child.layoutGrow !== undefined) {
          node.setFlexGrow(Math.max(0, finite(child.layoutGrow)));
        }
        if (child.minWidth !== undefined && Number.isFinite(child.minWidth)) {
          node.setMinWidth(Math.max(0, child.minWidth));
        }
        if (child.maxWidth !== undefined && Number.isFinite(child.maxWidth)) {
          node.setMaxWidth(Math.max(0, child.maxWidth));
        }
        if (child.minHeight !== undefined && Number.isFinite(child.minHeight)) {
          node.setMinHeight(Math.max(0, child.minHeight));
        }
        if (child.maxHeight !== undefined && Number.isFinite(child.maxHeight)) {
          node.setMaxHeight(Math.max(0, child.maxHeight));
        }

        root.insertChild(node, root.getChildCount());
        return { child, node };
      });

      root.calculateLayout(parent.width, parent.height, Yoga.DIRECTION_LTR);
      for (const item of childNodes) {
        const patch: { x: number; y: number; width?: number; height?: number } = {
          x: item.node.getComputedLeft(),
          y: item.node.getComputedTop(),
        };
        const computedW = item.node.getComputedWidth();
        const computedH = item.node.getComputedHeight();
        if (computedW !== item.child.width) patch.width = computedW;
        if (computedH !== item.child.height) patch.height = computedH;
        patches.set(item.child.id, patch);
      }
      for (const item of childNodes) item.node.free();
      root.free();
    } catch {
      continue;
    }
  }

  if (!patches.size) return layers;
  return layers.map((layer) => {
    const patch = patches.get(layer.id);
    return patch ? { ...layer, ...patch } : layer;
  });
}
