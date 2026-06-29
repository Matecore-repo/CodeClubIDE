import type { DesignLayer, DesignPage } from "./design";
import { buildDesignLayerIndex } from "./designLayers";

export type DesignLintSeverity = "info" | "warning" | "error";

export interface DesignLintFinding {
  ruleId: string;
  severity: DesignLintSeverity;
  layerId?: string;
  layerName?: string;
  message: string;
}

export interface DesignLintReport {
  findings: DesignLintFinding[];
  summary: Record<DesignLintSeverity, number>;
  colors: string[];
  typography: Array<{ family?: string; size?: number; layerId: string }>;
}

const DEFAULT_NAMES = new Set(["layer", "rectangle", "frame", "group", "text"]);

function visibleFill(layer?: DesignLayer): string | null {
  if (!layer) return null;
  const fill =
    layer.fills?.find((item) => item.visible !== false && item.type === "solid")?.color ??
    layer.fill;
  return /^#[0-9a-fA-F]{6}$/.test(fill) ? fill : null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  };
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const channel = (value: number) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function nearestParentFill(layer: DesignLayer, layers: DesignLayer[]): string | null {
  const index = buildDesignLayerIndex(layers);
  let parent = layer.parentId ? index.byId.get(layer.parentId) : null;
  while (parent) {
    const fill = visibleFill(parent);
    if (fill) return fill;
    parent = parent.parentId ? index.byId.get(parent.parentId) : null;
  }
  return null;
}

function addFinding(
  findings: DesignLintFinding[],
  layer: DesignLayer,
  ruleId: string,
  severity: DesignLintSeverity,
  message: string,
) {
  findings.push({ ruleId, severity, layerId: layer.id, layerName: layer.name, message });
}

function collectColors(layers: DesignLayer[]): string[] {
  const colors = new Set<string>();
  for (const layer of layers) {
    const fill = visibleFill(layer);
    if (fill && !fill.startsWith("$")) colors.add(fill);
    for (const f of layer.fills ?? []) {
      if (f.type === "solid" && f.color && !f.color.startsWith("$")) colors.add(f.color);
      if (f.stops)
        for (const s of f.stops) if (s.color && !s.color.startsWith("$")) colors.add(s.color);
    }
    for (const s of layer.strokes ?? [])
      if (s.color && !s.color.startsWith("$")) colors.add(s.color);
    for (const e of layer.effects ?? [])
      if (e.color && !e.color.startsWith("$")) colors.add(e.color);
  }
  return Array.from(colors).sort();
}

function collectTypography(layers: DesignLayer[]): DesignLintReport["typography"] {
  return layers
    .filter((l) => l.type === "text" && l.visible)
    .map((l) => ({ layerId: l.id, size: 16 }));
}

function checkConsistentSpacing(layers: DesignLayer[], findings: DesignLintFinding[]) {
  const index = buildDesignLayerIndex(layers);
  for (const parent of layers) {
    const children = index.childrenByParent.get(parent.id) ?? [];
    if (children.length < 3) continue;

    const gaps: number[] = [];
    const sorted = [...children].sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const verticalGap = curr.y - (prev.y + prev.height);
      const horizontalGap = curr.x - (prev.x + prev.width);
      if (verticalGap > 0) gaps.push(verticalGap);
      else if (horizontalGap > 0) gaps.push(horizontalGap);
    }
    if (!gaps.length) continue;

    const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    const tolerance = Math.max(2, median * 0.3);
    const outliers = gaps.filter((g) => Math.abs(g - median) > tolerance);
    if (outliers.length && outliers.length >= Math.ceil(gaps.length / 3)) {
      findings.push({
        ruleId: "consistent-spacing",
        severity: "info",
        layerId: parent.id,
        layerName: parent.name,
        message: `Spacing between children is inconsistent (median: ${Math.round(median)}px, ${outliers.length} outliers).`,
      });
    }
  }
}

export function lintDesignPage(page: DesignPage): DesignLintReport {
  const findings: DesignLintFinding[] = [];

  for (const layer of page.layers) {
    const normalizedName = layer.name
      .trim()
      .replace(/\s+\d+$/g, "")
      .toLowerCase();
    if (DEFAULT_NAMES.has(normalizedName)) {
      addFinding(findings, layer, "no-default-names", "warning", "Layer uses a default name.");
    }

    if (!layer.visible) {
      addFinding(findings, layer, "unused-hidden-layers", "info", "Hidden layer was imported.");
      continue;
    }

    if (layer.type === "text" && !layer.text?.trim()) {
      addFinding(findings, layer, "empty-text", "warning", "Text layer is empty.");
    }

    if (
      layer.type !== "group" &&
      layer.type !== "draw" &&
      layer.width > 0 &&
      layer.height > 0 &&
      (layer.width < 44 || layer.height < 44)
    ) {
      addFinding(
        findings,
        layer,
        "touch-target-size",
        "warning",
        "Visible layer is smaller than 44x44.",
      );
    }

    if (layer.type === "text") {
      const foreground = visibleFill(layer);
      const background = nearestParentFill(layer, page.layers) ?? "#111111";
      if (foreground && contrastRatio(foreground, background) < 4.5) {
        addFinding(findings, layer, "color-contrast", "warning", "Text contrast is below 4.5:1.");
      }
    }
  }

  checkConsistentSpacing(page.layers, findings);

  return {
    findings,
    summary: findings.reduce<Record<DesignLintSeverity, number>>(
      (summary, finding) => {
        summary[finding.severity] += 1;
        return summary;
      },
      { info: 0, warning: 0, error: 0 },
    ),
    colors: collectColors(page.layers),
    typography: collectTypography(page.layers),
  };
}
