import { afterEach } from "vitest";

// Babylon Lite 1.3 evaluates shader-stage constants when its root module loads.
// Browsers with WebGPU provide this global; jsdom does not.
Object.defineProperty(globalThis, "GPUShaderStage", {
  configurable: true,
  value: { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 }
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});
