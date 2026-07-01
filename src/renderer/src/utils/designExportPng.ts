import { CanvasKitRenderer, preloadCanvasKit } from "../hooks/useCanvasKitRenderer";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function exportDesignPng(
  workspacePath: string,
  pageId: string,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const boundsResult = await (window as any).api.designExportPng(workspacePath, pageId);
  if (!boundsResult?.ok) {
    return { ok: false, error: boundsResult?.error || "Failed to get page bounds." };
  }

  const { layers: layersJson, width, height, exportPath } = boundsResult;
  await preloadCanvasKit();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = new CanvasKitRenderer(canvas);
  renderer.sync_layers(layersJson);
  const pngBytes = renderer.exportPng(width, height);
  renderer.free();
  if (!pngBytes) {
    return { ok: false, error: "Failed to render PNG." };
  }

  const base64 = bytesToBase64(pngBytes);
  const writeResult = await (window as any).api.designWritePng(exportPath, base64);
  if (!writeResult?.ok) {
    return { ok: false, error: writeResult?.error || "Failed to write PNG file." };
  }

  return { ok: true, path: writeResult.path };
}
