import { Group } from "tweedle.js";
import { Application, Ticker } from "pixi.js";

export let currenRenderer: string;

export async function createApp(preference: 'webgl' | 'webgpu' = 'webgpu') {
    if (document.getElementById("WDS")) {
      document.getElementById("WDS")!.remove();
    }

    if(preference.toLocaleLowerCase() != 'webgl' && preference.toLocaleLowerCase() != 'webgpu'){
      preference = 'webgpu'; // default to webgpu
    }

    const pixiapp = new Application();
    await pixiapp.init({
      preference,
      hello : false,
      width: 1920,
      height: 1080,
      backgroundAlpha: 0,
    });

    currenRenderer = pixiapp.renderer.name;

    (globalThis as any).__PIXI_APP__ = pixiapp;
  
    pixiapp.canvas.setAttribute("id", "WDS");
    const container = document.getElementById("canvas-container") || document.body;
    container.appendChild(pixiapp.canvas);
  
    Ticker.shared.add(() => Group.shared.update());
  
    let resize = () => {
      const isMobile = window.innerWidth <= 768;
      
      let screenWidth = window.innerWidth;
      let screenHeight = window.innerHeight;
      
      if (!isMobile) {
        const containerEl = document.getElementById("canvas-container");
        if (containerEl) {
          screenWidth = containerEl.clientWidth;
          screenHeight = containerEl.clientHeight;
        }
        // Scale down to 90% of container space on desktop
        screenWidth = screenWidth * 0.9;
        screenHeight = screenHeight * 0.9;
      } else {
        // On mobile, canvas is fixed/floating, make it 90% of screen width
        screenWidth = window.innerWidth * 0.9;
        screenHeight = screenWidth * (1080 / 1920);
      }

      const ratio = Math.min(screenWidth / 1920, screenHeight / 1080);
  
      let resizedX = Math.floor(1920 * ratio);
      let resizedY = Math.floor(1080 * ratio);
  
      pixiapp.canvas.style.width = resizedX + "px";
      pixiapp.canvas.style.height = resizedY + "px";
    };
    
    window.onresize = () => resize();
    resize();
    
    return pixiapp;
}