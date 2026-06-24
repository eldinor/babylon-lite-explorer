export function demoUrl(path = ""): string {
  if (import.meta.env.DEV) {
    return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).href;
  }

  // Production chunks live in demo-dist/assets, beside the demo's public files.
  // Derive the demo root at runtime so Vite does not rewrite this as an asset.
  const demoRoot = new URL(import.meta.url);
  demoRoot.pathname = demoRoot.pathname.replace(/\/assets\/[^/]+$/, "/");
  return new URL(path, demoRoot).href;
}
