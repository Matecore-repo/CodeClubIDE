import type { DesignLayer, DesignPage } from "./design";
import { buildDesignLayerIndex } from "./designLayers";
import { normalizeDesignImportPage } from "./designImportValidation";
import { extractDesignTokens } from "./designTokens";
import type { DesignTokenCollection } from "./design";

export interface DesignExportBundle {
  version: 1;
  exportedAt: string;
  page: DesignPage;
  jsx: string;
  tailwind: Record<string, string>;
  tokens: {
    colors: string[];
    gradients: string[];
    spacing: number[];
    radii: number[];
    shadows: string[];
    namedTokens: DesignTokenCollection;
  };
  xpaths: Array<{
    layerId: string;
    name: string;
    type: string;
    parentId: string | null;
    path: string;
  }>;
  warnings: string[];
}

function componentName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const pascal = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return pascal || "codeclubDesign";
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function solidColor(layer: DesignLayer): string | null {
  const fill =
    layer.fills?.find((item) => item.visible !== false && item.type === "solid")?.color ??
    layer.fill;
  return /^#[0-9a-fA-F]{6}$/.test(fill) ? fill : null;
}

function styleForLayer(layer: DesignLayer): Record<string, string | number> {
  const style: Record<string, string | number> = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
  };
  const color = solidColor(layer);
  if (color && layer.type !== "text") style.backgroundColor = color;
  if (color && layer.type === "text") style.color = color;
  if (layer.opacity !== undefined) style.opacity = layer.opacity;
  if (layer.cornerRadius) style.borderRadius = layer.cornerRadius;
  if (layer.rotation) style.transform = `rotate(${layer.rotation}deg)`;
  const shadow = layer.effects?.find(
    (effect) => effect.visible !== false && effect.type === "drop-shadow",
  );
  if (shadow) {
    style.boxShadow = `${shadow.x ?? 0}px ${shadow.y ?? 0}px ${shadow.radius}px ${shadow.color ?? "#000000"}`;
  }
  if (layer.layoutMode === "horizontal" || layer.layoutMode === "vertical") {
    style.display = "flex";
    style.flexDirection = layer.layoutMode === "horizontal" ? "row" : "column";
    if (layer.layoutGap) style.gap = layer.layoutGap;
    if (layer.paddingTop) style.paddingTop = layer.paddingTop;
    if (layer.paddingRight) style.paddingRight = layer.paddingRight;
    if (layer.paddingBottom) style.paddingBottom = layer.paddingBottom;
    if (layer.paddingLeft) style.paddingLeft = layer.paddingLeft;
  }
  return style;
}

function styleString(style: Record<string, string | number>): string {
  return Object.entries(style)
    .map(([key, value]) => `${key}: ${typeof value === "number" ? value : quote(value)}`)
    .join(", ");
}

function layerTailwind(layer: DesignLayer): string {
  const classes = ["absolute"];
  if (layer.layoutMode === "horizontal") classes.push("flex", "flex-row");
  if (layer.layoutMode === "vertical") classes.push("flex", "flex-col");
  if (layer.type === "ellipse") classes.push("rounded-full");
  if (layer.type === "text") classes.push("text-base");
  return classes.join(" ");
}

function layerTag(layer: DesignLayer): string {
  if (layer.type === "text") return "span";
  return "div";
}

function renderLayer(
  layer: DesignLayer,
  children: DesignLayer[],
  allChildren: Map<string | null, DesignLayer[]>,
  depth: number,
): string {
  const indent = "  ".repeat(depth);
  const tag = layerTag(layer);
  const props = `className=${quote(layerTailwind(layer))} style={{ ${styleString(styleForLayer(layer))} }}`;
  if (layer.type === "text") {
    return `${indent}<${tag} ${props}>${escapeText(layer.text ?? "")}</${tag}>`;
  }
  if (!children.length) return `${indent}<${tag} ${props} />`;
  const body = children
    .map((child) => renderLayer(child, allChildren.get(child.id) ?? [], allChildren, depth + 1))
    .join("\n");
  return `${indent}<${tag} ${props}>\n${body}\n${indent}</${tag}>`;
}

function buildJsx(page: DesignPage): string {
  const index = buildDesignLayerIndex(page.layers);
  const roots = index.childrenByParent.get(null) ?? [];
  const name = componentName(page.name);
  const body = roots
    .map((layer) =>
      renderLayer(layer, index.childrenByParent.get(layer.id) ?? [], index.childrenByParent, 2),
    )
    .join("\n");
  return `export function ${name}() {\n  return (\n    <div className="relative">\n${body}\n    </div>\n  );\n}`;
}

function buildXPaths(page: DesignPage): DesignExportBundle["xpaths"] {
  const index = buildDesignLayerIndex(page.layers);
  const result: DesignExportBundle["xpaths"] = [];
  const visit = (layer: DesignLayer, prefix: string, siblings: DesignLayer[]) => {
    const sameType = siblings.filter((item) => item.type === layer.type);
    const position = sameType.findIndex((item) => item.id === layer.id) + 1;
    const segment = `${componentName(layer.name || layer.type)}[${position || 1}]`;
    const path = `${prefix}/${segment}`;
    result.push({
      layerId: layer.id,
      name: layer.name,
      type: layer.type,
      parentId: layer.parentId,
      path,
    });
    const children = index.childrenByParent.get(layer.id) ?? [];
    for (const child of children) visit(child, path, children);
  };
  const roots = index.childrenByParent.get(null) ?? [];
  for (const root of roots) visit(root, `/${componentName(page.name)}`, roots);
  return result;
}

function buildTokens(page: DesignPage): DesignExportBundle["tokens"] {
  const named = extractDesignTokens(page.layers);
  const colors = new Set<string>();
  const gradients = new Set<string>();
  const spacing = new Set<number>();
  const radii = new Set<number>();
  const shadows = new Set<string>();
  for (const layer of page.layers) {
    for (const fill of layer.fills ?? []) {
      if (fill.type === "solid" && fill.color) colors.add(fill.color);
      if (fill.type !== "solid" && fill.stops?.length)
        gradients.add(fill.stops.map((stop) => `${stop.color}:${stop.position}`).join("|"));
    }
    const fallbackColor = solidColor(layer);
    if (fallbackColor) colors.add(fallbackColor);
    for (const value of [
      layer.layoutGap,
      layer.paddingTop,
      layer.paddingRight,
      layer.paddingBottom,
      layer.paddingLeft,
    ]) {
      if (typeof value === "number" && Number.isFinite(value)) spacing.add(value);
    }
    if (layer.cornerRadius) radii.add(layer.cornerRadius);
    for (const effect of layer.effects ?? []) {
      if (effect.type === "drop-shadow")
        shadows.add(
          `${effect.x ?? 0}px ${effect.y ?? 0}px ${effect.radius}px ${effect.color ?? "#000000"}`,
        );
    }
  }
  return {
    colors: Array.from(colors),
    gradients: Array.from(gradients),
    spacing: Array.from(spacing).sort((a, b) => a - b),
    radii: Array.from(radii).sort((a, b) => a - b),
    shadows: Array.from(shadows),
    namedTokens: named,
  };
}

function buildWarnings(page: DesignPage): string[] {
  const warnings = new Set<string>();
  for (const layer of page.layers) {
    if (layer.type === "draw")
      warnings.add("Freehand draw layers export as positioned div placeholders.");
    if (layer.effects?.some((effect) => effect.type === "inner-shadow"))
      warnings.add("Inner shadow renders approximately and exports as a warning-only effect.");
    if (layer.effects?.some((effect) => effect.type === "layer-blur"))
      warnings.add("Layer blur renders approximately and is not exported as pixel-perfect CSS.");
    if (layer.clipsContent) warnings.add("Clipping renders in canvas but exports approximately.");
    if (layer.vectorPath)
      warnings.add("Vector paths render when supported but export as static positioned markup.");
    if (layer.componentRole === "instance")
      warnings.add("Instances export as static markup; component sync is not exported.");
  }
  return Array.from(warnings);
}

export function exportDesignBundle(input: DesignPage): DesignExportBundle {
  const { page, warnings } = normalizeDesignImportPage(input, input.name || "codeclub Design");
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    page,
    jsx: buildJsx(page),
    tailwind: Object.fromEntries(page.layers.map((layer) => [layer.id, layerTailwind(layer)])),
    tokens: buildTokens(page),
    xpaths: buildXPaths(page),
    warnings: [...warnings, ...buildWarnings(page)],
  };
}

function componentNameFromInput(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const pascal = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return pascal || "codeclubDesign";
}

function buildCssModule(page: DesignPage): string {
  const name = componentNameFromInput(page.name);
  const lines = [`/* ${page.name} */`, `.${name.toLowerCase()}-root { position: relative; }`];
  const colors = new Set<string>();
  const radii = new Set<number>();
  const shadows = new Set<string>();

  for (const layer of page.layers) {
    const color = solidColor(layer);
    if (color && layer.type !== "text") {
      lines.push(`.${componentName(layer.name).toLowerCase()}-bg { background-color: ${color}; }`);
    }
    if (layer.cornerRadius) radii.add(layer.cornerRadius);
    const shadow = layer.effects?.find((e) => e.visible !== false && e.type === "drop-shadow");
    if (shadow) {
      shadows.add(
        `${shadow.x ?? 0}px ${shadow.y ?? 0}px ${shadow.radius}px ${shadow.color ?? "#000000"}`,
      );
    }
    for (const fill of layer.fills ?? []) {
      if (fill.type === "solid" && fill.color) colors.add(fill.color);
    }
  }
  return lines.join("\n  ");
}

function buildTokensJson(page: DesignPage): string {
  const tokens = buildTokens(page);
  return JSON.stringify(
    {
      name: page.name,
      exportedAt: new Date().toISOString(),
      values: {
        colors: tokens.colors,
        gradients: tokens.gradients,
        spacing: tokens.spacing,
        radii: tokens.radii,
        shadows: tokens.shadows,
      },
      named: tokens.namedTokens,
    },
    null,
    2,
  );
}

export interface DesignExportFiles {
  tsx: string;
  css: string;
  tokensJson: string;
  pageName: string;
}

export function buildDesignExportFiles(input: DesignPage): DesignExportFiles {
  const { page } = normalizeDesignImportPage(input, input.name || "codeclub Design");
  const safeName = componentNameFromInput(page.name);
  return {
    tsx: buildJsx(page),
    css: buildCssModule(page),
    tokensJson: buildTokensJson(page),
    pageName: safeName,
  };
}
