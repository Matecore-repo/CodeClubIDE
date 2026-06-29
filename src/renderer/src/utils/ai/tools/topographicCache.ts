export const topographicIdMap = new Map<string, string>();

export function resolveTopographicId(id: string): string {
  return topographicIdMap.get(id) ?? id;
}
