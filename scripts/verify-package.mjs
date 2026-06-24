import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const workspace = join(root, ".package-test");
const packages = join(workspace, "packages");
const consumer = join(workspace, "consumer");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const vite = join(root, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
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

try {
  const packed = JSON.parse(run(npm, ["pack", "--json", "--pack-destination", packages], root));
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
  console.log(`Verified ${packed[0].filename}: consumer emitted ${js} and ${css}.`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
