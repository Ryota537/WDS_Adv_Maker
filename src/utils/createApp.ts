import { Group } from "tweedle.js";
import { Application, Ticker } from "pixi.js";

export let currenRenderer: string;

export async function createApp(preference: 'webgl' | 'webgpu' = 'webgpu') {
  if (document.getElementById("WDS")) {
    document.getElementById("WDS")!.remove();
  }

  if (preference.toLocaleLowerCase() != 'webgl' && preference.toLocaleLowerCase() != 'webgpu') {
    preference = 'webgpu'; // default to webgpu
  }

  const pixiapp = new Application();

  try {
    await pixiapp.init({
      preference,
      hello: false,
      width: 1920,
      height: 1080,
      backgroundAlpha: 0,
    });
  } catch (err) {
    console.error(`[createApp] Failed to initialize PixiJS with "${preference}" renderer:`, err);

    // If WebGPU failed, show fallback message
    if (preference === 'webgpu') {
      showRendererFallbackMessage();
    }
    throw err;
  }

  currenRenderer = pixiapp.renderer.name;

  (globalThis as any).__PIXI_APP__ = pixiapp;

  pixiapp.canvas.setAttribute("id", "WDS");
  const container = document.getElementById("canvas-container") || document.body;
  container.appendChild(pixiapp.canvas);

  Ticker.shared.add(() => Group.shared.update());

  // Listen for uncaptured WebGPU device errors (e.g. texture limit exceeded)
  if (preference === 'webgpu') {
    try {
      const gpuDevice = (pixiapp.renderer as any)?.gpu?.device;
      if (gpuDevice) {
        gpuDevice.addEventListener('uncapturederror', (event: any) => {
          // console.error('[createApp] WebGPU uncaptured error:', event.error);
          showRendererFallbackMessage();
        });
      }
    } catch (_) {
      // Silently ignore if we can't access the GPU device
    }
  }

  // Detect canvas render failure after a short delay (e.g. WebGPU texture limit exceeded)
  setTimeout(() => {
    checkCanvasRendered(pixiapp.canvas);
  }, 5000);

  let resize = () => {
    let screenWidth = window.innerWidth;
    let screenHeight = window.innerHeight;

    const containerEl = document.getElementById("canvas-container");
    if (containerEl && containerEl.clientWidth > 50 && containerEl.clientHeight > 50) {
      screenWidth = containerEl.clientWidth - 50;
      screenHeight = containerEl.clientHeight - 50;
    } else {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        screenWidth = window.innerWidth - 50;
        screenHeight = 500 - 50;
      } else {
        screenWidth = (window.innerWidth - 300) - 50;
        screenHeight = window.innerHeight - 50;
      }
    }

    const ratio = Math.max(0, Math.min(screenWidth / 1920, screenHeight / 1080));

    let resizedX = Math.floor(1920 * ratio);
    let resizedY = Math.floor(1080 * ratio);

    pixiapp.canvas.style.width = resizedX + "px";
    pixiapp.canvas.style.height = resizedY + "px";
  };

  window.onresize = () => resize();
  resize();

  return pixiapp;
}

/**
 * Check if the canvas has actually rendered any content.
 * On some mobile devices with WebGPU, the canvas may init successfully
 * but fail to render due to hardware limits (e.g. max sampled textures exceeded).
 */
function checkCanvasRendered(canvas: HTMLCanvasElement) {
  try {
    // Try to read pixels from the canvas to see if it rendered
    const width = canvas.width;
    const height = canvas.height;

    // If canvas has 0 dimension, it didn't render
    if (width === 0 || height === 0) {
      console.warn("[createApp] Canvas has 0 dimensions — rendering likely failed.");
      showRendererFallbackMessage();
      return;
    }

    // Check computed CSS size — if the browser collapsed it
    const computedStyle = window.getComputedStyle(canvas);
    const cssWidth = parseFloat(computedStyle.width);
    const cssHeight = parseFloat(computedStyle.height);
    if (cssWidth === 0 || cssHeight === 0) {
      console.warn("[createApp] Canvas CSS size is 0 — rendering likely failed.");
      showRendererFallbackMessage();
      return;
    }

    // Check for WebGPU-specific rendering failures using canvas snapshot
    if (currenRenderer && currenRenderer.toLowerCase().includes('webgpu')) {
      try {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = Math.min(canvas.width, 64);
        testCanvas.height = Math.min(canvas.height, 64);
        const ctx = testCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, 0, testCanvas.width, testCanvas.height);
          const imageData = ctx.getImageData(0, 0, testCanvas.width, testCanvas.height);
          const data = imageData.data;

          // Check if any pixel has non-zero alpha (meaning something was rendered)
          let hasContent = false;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) {
              hasContent = true;
              break;
            }
          }

          if (!hasContent) {
            console.warn("[createApp] Canvas appears empty after 5s — WebGPU rendering may have failed silently.");
            showRendererFallbackMessage();
          } else {
            // Render succeeded, cancel any scheduled fallback message
            cancelRendererFallbackMessage();
          }
        }
      } catch (snapshotErr) {
        console.warn("[createApp] Could not snapshot canvas for render check:", snapshotErr);
      }
    }
  } catch (err) {
    console.warn("[createApp] Error checking canvas render state:", err);
  }
}

let fallbackTimeoutId: any = null;

/**
 * Cancel the scheduled fallback message if rendering is successful.
 */
export function cancelRendererFallbackMessage() {
  if (fallbackTimeoutId) {
    clearTimeout(fallbackTimeoutId);
    fallbackTimeoutId = null;
  }
}

/**
 * Show the fallback message directing users to use WebGL renderer after 5 seconds delay.
 */
export function showRendererFallbackMessage() {
  // If already displayed, ensure it's visible
  const existing = document.getElementById("renderer-fallback-msg");
  if (existing) {
    existing.style.display = "block";
    return;
  }

  // If a timeout is already scheduled, don't schedule another one
  if (fallbackTimeoutId) return;

  fallbackTimeoutId = setTimeout(() => {
    // Re-check existence inside timeout callback
    if (document.getElementById("renderer-fallback-msg")) return;

    const container = document.getElementById("canvas-container");
    if (!container) return;

    // Hide the canvas so it doesn't block the fallback message clicks
    const canvas = document.getElementById("WDS");
    if (canvas) {
      canvas.style.display = "none";
    }

    const msg = document.createElement("div");
    msg.id = "renderer-fallback-msg";
    msg.innerHTML = `
      <p class="fallback-text">
        Canvas not showing?
        <a class="fallback-link" href="?renderer=webgl">Try to open with this link</a>.
      </p>
    `;
    container.appendChild(msg);
  }, 5000);
}