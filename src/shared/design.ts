export interface DesignPageSummary {
  id: string;
  name: string;
  updatedAt: number;
  layerCount?: number;
}

export interface DesignManifest {
  version: 1;
  activePageId: string | null;
  pages: DesignPageSummary[];
}

export interface DesignTokenCollection {
  colors: Record<string, string>;
  spacing: Record<string, number>;
  radii: Record<string, number>;
  shadows: Record<string, string>;
  typography: Record<
    string,
    {
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: number;
      lineHeight?: number;
    }
  >;
  gradients: Record<
    string,
    {
      type: "linear-gradient" | "radial-gradient";
      stops: Array<{ color: string; position: number; opacity?: number }>;
      transform?: number[];
    }
  >;
}

export const EMPTY_TOKENS: DesignTokenCollection = {
  colors: {},
  spacing: {},
  radii: {},
  shadows: {},
  typography: {},
  gradients: {},
};

export interface DesignFill {
  type: "solid" | "linear-gradient" | "radial-gradient";
  color?: string;
  stops?: Array<{ color: string; position: number; opacity?: number }>;
  opacity?: number;
  visible?: boolean;
  transform?: number[];
}

export interface DesignStroke {
  color: string;
  weight: number;
  opacity?: number;
  visible?: boolean;
  align?: "inside" | "center" | "outside";
}

export interface DesignEffect {
  type: "drop-shadow" | "inner-shadow" | "layer-blur";
  color?: string;
  x?: number;
  y?: number;
  radius: number;
  opacity?: number;
  visible?: boolean;
}

export interface DesignLayer {
  id: string;
  name: string;
  type: "group" | "frame" | "rectangle" | "ellipse" | "triangle" | "text" | "draw";
  parentId: string | null;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  fills?: DesignFill[];
  strokes?: DesignStroke[];
  effects?: DesignEffect[];
  opacity?: number;
  rotation?: number;
  cornerRadius?: number;
  layoutMode?: "none" | "horizontal" | "vertical";
  layoutGap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  layoutAlign?: "start" | "center" | "end" | "space-between";
  layoutCrossAlign?: "start" | "center" | "end" | "stretch";
  layoutGrow?: number;
  layoutWrap?: "nowrap" | "wrap";
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  componentRole?: "component" | "instance" | "component-set";
  componentId?: string;
  instanceOf?: string;
  variantProperties?: Record<string, string>;
  isDetachedInstance?: boolean;
  overrideProperties?: string[];
  clipsContent?: boolean;
  vectorPath?: string;
  windingRule?: "nonzero" | "evenodd";
  text?: string;
  points?: Array<{ x: number; y: number }>;
}

export interface DesignPage {
  version: 1;
  id: string;
  name: string;
  layers: DesignLayer[];
}
