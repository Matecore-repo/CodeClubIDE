import type { DesignLayer, DesignPage } from "./design";

const SYNC_KEYS: Array<keyof DesignLayer> = [
  "fill",
  "fills",
  "strokes",
  "effects",
  "opacity",
  "rotation",
  "cornerRadius",
  "width",
  "height",
  "visible",
  "locked",
  "clipsContent",
  "vectorPath",
  "windingRule",
  "points",
];

export function syncComponentToInstances(page: DesignPage, componentLayerId: string): DesignPage {
  const component = page.layers.find(
    (l) => l.id === componentLayerId && l.componentRole === "component",
  );
  if (!component) return page;

  const componentId = component.componentId ?? component.id;
  const instances = page.layers.filter(
    (l) => l.componentRole === "instance" && l.instanceOf === componentId && !l.isDetachedInstance,
  );

  if (!instances.length) return page;

  for (const instance of instances) {
    const overrides = new Set(instance.overrideProperties ?? []);
    for (const key of SYNC_KEYS) {
      if (overrides.has(key)) continue;
      if (key === "x" || key === "y") continue;
      (instance as any)[key] = (component as any)[key];
    }
    if (!overrides.has("text") && component.type === "text") {
      instance.text = component.text;
    }
  }

  return page;
}
