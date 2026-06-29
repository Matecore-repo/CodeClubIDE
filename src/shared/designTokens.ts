import type {
  DesignLayer,
  DesignTokenCollection,
  DesignFill,
  DesignStroke,
  DesignEffect,
} from "./design";

export function isTokenRef(value: string): boolean {
  return typeof value === "string" && /^\$[a-zA-Z][a-zA-Z0-9_.-]+$/.test(value);
}

function resolveColorRef(ref: string, tokens: DesignTokenCollection): string {
  const parts = ref.slice(1).split(".");
  const category = parts[0];
  const key = parts.slice(1).join(".");
  if (category === "colors" && tokens.colors[key]) return tokens.colors[key];
  if (category === "shadows" && tokens.shadows[key]) return tokens.shadows[key];
  return ref;
}

function resolveStrokeColor(stroke: DesignStroke, tokens: DesignTokenCollection): DesignStroke {
  if (isTokenRef(stroke.color)) return { ...stroke, color: resolveColorRef(stroke.color, tokens) };
  return stroke;
}

function resolveEffectColor(effect: DesignEffect, tokens: DesignTokenCollection): DesignEffect {
  if (effect.color && isTokenRef(effect.color))
    return { ...effect, color: resolveColorRef(effect.color, tokens) };
  return effect;
}

function resolveFillColor(fill: DesignFill, tokens: DesignTokenCollection): DesignFill {
  let resolved = fill;
  if (fill.color && isTokenRef(fill.color)) {
    resolved = { ...resolved, color: resolveColorRef(fill.color, tokens) };
  }
  if (fill.type !== "solid" && fill.stops) {
    resolved = {
      ...resolved,
      stops: fill.stops.map((s) =>
        isTokenRef(s.color) ? { ...s, color: resolveColorRef(s.color, tokens) } : s,
      ),
    };
  }
  return resolved;
}

export function resolveDesignTokens(
  layers: DesignLayer[],
  tokens: DesignTokenCollection,
): DesignLayer[] {
  if (!tokens || !Object.values(tokens).some((cat) => Object.keys(cat).length)) return layers;
  return layers.map((layer) => {
    let resolved = layer;
    if (isTokenRef(layer.fill))
      resolved = { ...resolved, fill: resolveColorRef(layer.fill, tokens) };
    if (layer.fills)
      resolved = { ...resolved, fills: layer.fills.map((f) => resolveFillColor(f, tokens)) };
    if (layer.strokes)
      resolved = { ...resolved, strokes: layer.strokes.map((s) => resolveStrokeColor(s, tokens)) };
    if (layer.effects)
      resolved = { ...resolved, effects: layer.effects.map((e) => resolveEffectColor(e, tokens)) };
    return resolved;
  });
}

function categorizeColor(hex: string, existing: DesignTokenCollection): string | null {
  for (const [name, value] of Object.entries(existing.colors)) {
    if (value.toLowerCase() === hex.toLowerCase()) return `$colors.${name}`;
  }
  return null;
}

export function extractDesignTokens(layers: DesignLayer[]): DesignTokenCollection {
  const colors = new Map<string, number>();
  const spacing = new Map<number, number>();
  const radii = new Map<number, number>();
  const shadows = new Map<string, number>();

  for (const layer of layers) {
    const fillHex = layer.fill;
    if (fillHex && /^#[0-9a-fA-F]{6}$/.test(fillHex))
      colors.set(fillHex, (colors.get(fillHex) ?? 0) + 1);
    for (const f of layer.fills ?? []) {
      if (f.type === "solid" && f.color && /^#[0-9a-fA-F]{6}$/.test(f.color))
        colors.set(f.color, (colors.get(f.color) ?? 0) + 1);
      if (f.stops)
        for (const s of f.stops) {
          if (s.color && /^#[0-9a-fA-F]{6}$/.test(s.color))
            colors.set(s.color, (colors.get(s.color) ?? 0) + 1);
        }
    }
    for (const s of layer.strokes ?? []) {
      if (s.color && /^#[0-9a-fA-F]{6}$/.test(s.color))
        colors.set(s.color, (colors.get(s.color) ?? 0) + 1);
    }
    for (const e of layer.effects ?? []) {
      if (e.color && /^#[0-9a-fA-F]{6}$/.test(e.color))
        colors.set(e.color, (colors.get(e.color) ?? 0) + 1);
    }
    if (layer.cornerRadius) radii.set(layer.cornerRadius, (radii.get(layer.cornerRadius) ?? 0) + 1);
    for (const value of [
      layer.layoutGap,
      layer.paddingTop,
      layer.paddingRight,
      layer.paddingBottom,
      layer.paddingLeft,
    ]) {
      if (typeof value === "number" && Number.isFinite(value))
        spacing.set(value, (spacing.get(value) ?? 0) + 1);
    }
  }

  const colorEntries = Array.from(colors.entries()).sort((a, b) => b[1] - a[1]);
  const colorTokens: Record<string, string> = {};
  colorEntries.forEach(([hex], i) => {
    colorTokens[`auto-${i + 1}`] = hex;
  });

  const spacingSorted = Array.from(spacing.entries()).sort((a, b) => a[0] - b[0]);
  const spacingTokens: Record<string, number> = {};
  spacingSorted.forEach(([value], i) => {
    spacingTokens[`spacing-${i + 1}`] = value;
  });

  const radiiSorted = Array.from(radii.entries()).sort((a, b) => a[0] - b[0]);
  const radiiTokens: Record<string, number> = {};
  radiiSorted.forEach(([value], i) => {
    radiiTokens[`radius-${i + 1}`] = value;
  });

  const shadowEntries = Array.from(shadows.entries()).sort((a, b) => b[1] - a[1]);
  const shadowTokens: Record<string, string> = {};
  shadowEntries.forEach(([value], i) => {
    shadowTokens[`shadow-${i + 1}`] = value;
  });

  return {
    colors: colorTokens,
    spacing: spacingTokens,
    radii: radiiTokens,
    shadows: shadowTokens,
    typography: {},
    gradients: {},
  };
}

export function autoApplyTokens(
  layers: DesignLayer[],
  tokens: DesignTokenCollection,
): DesignLayer[] {
  if (!Object.keys(tokens.colors).length) return layers;
  return layers.map((layer) => {
    let updated = layer;
    if (layer.fill && /^#[0-9a-fA-F]{6}$/.test(layer.fill)) {
      const ref = categorizeColor(layer.fill, tokens);
      if (ref) updated = { ...updated, fill: ref };
    }
    if (layer.fills) {
      updated = {
        ...updated,
        fills: layer.fills.map((f) => {
          if (f.type === "solid" && f.color && /^#[0-9a-fA-F]{6}$/.test(f.color)) {
            const ref = categorizeColor(f.color, tokens);
            return ref ? { ...f, color: ref } : f;
          }
          return f;
        }),
      };
    }
    if (layer.strokes) {
      updated = {
        ...updated,
        strokes: layer.strokes.map((s) => {
          if (s.color && /^#[0-9a-fA-F]{6}$/.test(s.color)) {
            const ref = categorizeColor(s.color, tokens);
            return ref ? { ...s, color: ref } : s;
          }
          return s;
        }),
      };
    }
    return updated;
  });
}
