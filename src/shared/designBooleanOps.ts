export type BooleanOp = "union" | "intersect" | "difference" | "xor";

export interface BooleanOpRequest {
  pageId: string;
  layerAId: string;
  layerBId: string;
  op: BooleanOp;
  targetName?: string;
}

export interface BooleanOpResult {
  svgPath: string;
  layerAName: string;
  layerBName: string;
  op: BooleanOp;
}

export function parseBooleanOp(value: string): BooleanOp | null {
  switch (value) {
    case "union":
      return "union";
    case "intersect":
      return "intersect";
    case "difference":
      return "difference";
    case "xor":
      return "xor";
    default:
      return null;
  }
}

export const BOOLEAN_OPS: BooleanOp[] = ["union", "intersect", "difference", "xor"];
