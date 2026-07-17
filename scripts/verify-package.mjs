import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const workspace = join(root, ".package-test");
const packages = join(workspace, "packages");
const consumer = join(workspace, "consumer");
const adapterConsumer = join(workspace, "adapter-consumer");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const vite = join(root, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
const tsc = join(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
const env = { ...process.env, npm_config_cache: join(root, ".npm-cache") };

const run = (command, args, cwd) => execFileSync(command, args, {
  cwd,
  env,
  shell: process.platform === "win32",
  stdio: "pipe",
  encoding: "utf8"
});

rmSync(workspace, { recursive: true, force: true });
mkdirSync(packages, { recursive: true });
mkdirSync(consumer, { recursive: true });
mkdirSync(adapterConsumer, { recursive: true });

try {
  // verify:package builds explicitly before this script. Avoid running prepack a
  // second time because lifecycle output is mixed into npm pack --json stdout.
  const packed = JSON.parse(run(npm, ["pack", "--ignore-scripts", "--json", "--pack-destination", packages], root));
  const tarball = join(packages, packed[0].filename);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    private: true,
    type: "module",
    dependencies: { "babylon-lite-explorer": `file:${tarball.replaceAll("\\", "/")}` }
  }, null, 2));
  writeFileSync(join(consumer, "index.html"), '<!doctype html><html><body><script type="module" src="/src.ts"></script></body></html>');
  writeFileSync(join(consumer, "src.ts"), 'import { showLiteExplorer } from "babylon-lite-explorer"; console.log(typeof showLiteExplorer);');

  run(npm, ["install", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund"], consumer);
  run(vite, ["build", "--configLoader", "runner"], consumer);

  const assets = join(consumer, "dist", "assets");
  const emitted = readdirSync(assets);
  const css = emitted.find((file) => file.endsWith(".css"));
  const js = emitted.find((file) => file.endsWith(".js"));
  if (!css || !js) throw new Error(`Expected JavaScript and CSS assets, received: ${emitted.join(", ")}`);
  if (!readFileSync(join(assets, css), "utf8").includes(".ble-root")) throw new Error("Consumer CSS does not contain Explorer styles.");
  const installedEntry = join(consumer, "node_modules", "babylon-lite-explorer", "dist", "index.js");
  if (!existsSync(installedEntry) || !readFileSync(installedEntry, "utf8").startsWith('import "./lite-explorer.css";')) {
    throw new Error("Packed JavaScript entry does not import the extracted stylesheet.");
  }
  const browserEntry = join(consumer, "node_modules", "babylon-lite-explorer", "dist", "browser.js");
  const browserCss = join(consumer, "node_modules", "babylon-lite-explorer", "dist", "browser.css");
  if (!existsSync(browserEntry) || !existsSync(browserCss)) throw new Error("Packed browser/CDN entry is incomplete.");
  const browserSource = readFileSync(browserEntry, "utf8");
  if (!browserSource.startsWith('import "./browser.css";')) throw new Error("Browser entry does not import its stylesheet.");
  if (/from\s*["'](?:preact|@preact\/signals)/.test(browserSource)) {
    throw new Error("Browser entry unexpectedly externalizes Preact or Signals.");
  }
  const packageVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  if (!browserSource.includes(`Explorer ${packageVersion}`)) {
    throw new Error(`Browser entry does not contain package version ${packageVersion}.`);
  }

  const instancerPacked = JSON.parse(run(npm, ["pack", "--ignore-scripts", "--json", "--pack-destination", packages], join(root, "node_modules", "@litools", "instancer")));
  const instancerTarball = join(packages, instancerPacked[0].filename);
  writeFileSync(join(adapterConsumer, "package.json"), JSON.stringify({
    private: true,
    type: "module",
    dependencies: {
      "@litools/instancer": `file:${instancerTarball.replaceAll("\\", "/")}`,
      "babylon-lite-explorer": `file:${tarball.replaceAll("\\", "/")}`
    }
  }, null, 2));
  writeFileSync(join(adapterConsumer, "index.html"), '<!doctype html><html><body><script type="module" src="/src.ts"></script></body></html>');
  writeFileSync(join(adapterConsumer, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      lib: ["ES2022", "DOM"],
      module: "ESNext",
      moduleResolution: "Bundler",
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: "ES2022"
    },
    include: ["src.ts"]
  }, null, 2));
  writeFileSync(join(adapterConsumer, "src.ts"), `
import { createInstancerExplorerAdapter } from "babylon-lite-explorer";
import type { InstanceSet } from "@litools/instancer";

export function registerOfficialSet(set: InstanceSet<{ label: string }>) {
  const adapter = createInstancerExplorerAdapter();
  adapter.register(set, { getLabel: (id, metadata) => metadata?.label ?? \`Instance \${id}\` });
  return adapter.exportSet(set);
}
`);
  run(npm, ["install", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund"], adapterConsumer);
  run(tsc, ["-p", "tsconfig.json"], adapterConsumer);
  run(vite, ["build", "--configLoader", "runner"], adapterConsumer);

  console.log(`Verified ${packed[0].filename}: base and Instancer 0.3.1 consumers built successfully.`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
