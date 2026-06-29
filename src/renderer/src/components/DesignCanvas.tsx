import React, { useRef, useEffect } from "react";
import { useCanvasKitRenderer } from "../hooks/useCanvasKitRenderer";
import type { DesignLayer } from "../../../shared/design";

export const DesignCanvas: React.FC<{
  layers: DesignLayer[];
  zoom: number;
  panX: number;
  panY: number;
  onHit?: (layerId: string | null) => void;
}> = ({ layers, zoom, panX, panY, onHit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { renderer, isLoaded } = useCanvasKitRenderer(canvasRef);
  const sizeRef = useRef({ width: 1920, height: 1080 });

  useEffect(() => {
    if (isLoaded && renderer) {
      renderer.sync_layers(JSON.stringify(layers));
    }
  }, [layers, isLoaded, renderer]);

  useEffect(() => {
    if (isLoaded && renderer && canvasRef.current) {
      const canvas = canvasRef.current;

      const updateSize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        sizeRef.current = { width: rect.width, height: rect.height };
      };

      window.addEventListener("resize", updateSize);
      updateSize();

      let animationFrameId: number;
      const renderLoop = () => {
        renderer.render(sizeRef.current.width, sizeRef.current.height, zoom, panX, panY);
        animationFrameId = requestAnimationFrame(renderLoop);
      };
      renderLoop();

      const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const rect = canvas.getBoundingClientRect();
        const hitId = renderer.on_mouse_down(e.clientX - rect.left, e.clientY - rect.top);
        if (hitId) {
          e.stopPropagation();
          e.preventDefault();
          canvas.setPointerCapture(e.pointerId);
          onHit?.(hitId);
        } else {
          onHit?.(null);
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const patchId = renderer.on_mouse_move(e.clientX - rect.left, e.clientY - rect.top);
        if (patchId) {
          // You could optionally do something here during drag
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        const draggedLayerId = renderer.on_mouse_up();
        if (draggedLayerId) {
          const patchJson = renderer.get_layer_patch(draggedLayerId);
          if (patchJson) {
            try {
              const patch = JSON.parse(patchJson);
              window.dispatchEvent(
                new CustomEvent("codeclub:design-update-layer", {
                  detail: { layerId: draggedLayerId, patch },
                }),
              );
            } catch (e) {
              console.error("Failed to parse layer patch", e);
            }
          }
        }
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      };

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", updateSize);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
      };
    }
  }, [isLoaded, onHit, renderer, zoom, panX, panY]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {!isLoaded && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#888",
          }}
        >
          Loading CanvasKit...
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
          touchAction: "none",
        }}
      />
    </div>
  );
};
