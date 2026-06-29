import { useEffect, useState } from "react";
import init, { Renderer } from "../../../wasm-renderer/pkg/wasm_renderer.js";

let wasmInitPromise: Promise<any> | null = null;
let wasmReady = false;

// Pre-carga el motor globalmente para que sea instantáneo.
export function preloadWasmEngine() {
  if (!wasmInitPromise) {
    // Vite maneja los imports estáticos o las inicializaciones wasm-pack web automáticamente
    wasmInitPromise = init()
      .then(() => {
        wasmReady = true;
      })
      .catch((e: any) => console.error("Error inicializando WASM", e));
  }
  return wasmInitPromise;
}

// Iniciar precarga de inmediato al cargar este script
preloadWasmEngine();

export function useWasmRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  const [isLoaded, setIsLoaded] = useState(wasmReady);

  useEffect(() => {
    async function loadWasm() {
      if (!canvasRef.current) return;
      try {
        await preloadWasmEngine();
        setIsLoaded(true);
        // Crear instancia y guardarla en estado
        const instance = new Renderer(canvasRef.current);
        setRenderer(instance);
      } catch (e) {
        console.error("Error loading wasm renderer:", e);
      }
    }

    loadWasm();

    return () => {
      // Liberación de memoria podría implementarse con instance.free() si hay leaks
    };
  }, [canvasRef]);

  return { renderer, isLoaded };
}
