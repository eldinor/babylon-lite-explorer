import type { LiteEntity, LiteSceneAdapter } from "../adapter/LiteSceneAdapter";
import type { LiteExplorerContext } from "../api/types";
import { addToScene, loadGltf, type AssetContainer, type EngineContext, type SceneContext } from "@babylonjs/lite";
import { useRef, useState } from "preact/hooks";
import { useExplorerRuntime } from "./runtime";

type PublicEntitySnapshot = {
  label: string;
  kind: string;
  properties?: Record<string, unknown>;
  children?: PublicEntitySnapshot[];
};

export type PublicSceneSnapshot = {
  format: "babylon-lite-explorer-public-scene-snapshot";
  version: 1;
  exportedAt: string;
  entities: PublicEntitySnapshot[];
};

export async function loadGlbIntoScene(
  file: Blob,
  engine: EngineContext,
  scene: SceneContext,
  load: (engine: EngineContext, data: Blob) => Promise<AssetContainer> = loadGltf,
  add: (scene: SceneContext, asset: AssetContainer) => void = addToScene
): Promise<void> {
  add(scene, await load(engine, file));
}

export async function createPublicSceneSnapshot(
  tree: readonly LiteEntity[],
  adapter: LiteSceneAdapter,
  context: LiteExplorerContext,
  exportedAt = new Date().toISOString()
): Promise<PublicSceneSnapshot> {
  const snapshotEntity = async (entity: LiteEntity): Promise<PublicEntitySnapshot> => {
    const descriptors = await adapter.getProperties(entity, context);
    const result: PublicEntitySnapshot = { label: entity.label, kind: entity.kind };
    const properties = Object.fromEntries(descriptors
      .filter((descriptor) => !descriptor.path.startsWith("$"))
      .map((descriptor) => [descriptor.path, descriptor.value]));
    if (Object.keys(properties).length) result.properties = properties;
    if (entity.children?.length) result.children = await Promise.all(entity.children.map(snapshotEntity));
    return result;
  };
  return {
    format: "babylon-lite-explorer-public-scene-snapshot",
    version: 1,
    exportedAt,
    entities: await Promise.all(tree.map(snapshotEntity))
  };
}

export function ToolsPanel() {
  const { signals, refresh, notifications } = useExplorerRuntime();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "export" | null>(null);

  const uploadGlb = async (file: File) => {
    const context = signals.context.value;
    if (!context) return;
    setBusy("upload");
    try {
      await loadGlbIntoScene(file, context.engine as EngineContext, context.scene as SceneContext);
      await refresh.refreshTree();
      notifications.push(`Loaded ${file.name}`, "info");
    } catch (error) {
      notifications.push(error instanceof Error ? error.message : "Could not load the GLB file.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const exportScene = async () => {
    setBusy("export");
    try {
      const context = signals.context.value;
      const adapter = signals.adapter.value;
      if (!context || !adapter) throw new Error("Explorer scene context is unavailable.");
      const snapshot = await createPublicSceneSnapshot(signals.tree.value, adapter, context);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "babylon-lite-scene.json";
      link.click();
      URL.revokeObjectURL(url);
      notifications.push("Exported the public scene snapshot", "info");
    } catch (error) {
      notifications.push(error instanceof Error ? error.message : "Could not export the scene snapshot.");
    } finally {
      setBusy(null);
    }
  };

  return <div class="ble-tools">
    <section>
      <h3>Scene files</h3>
      <button type="button" disabled={busy !== null} onClick={() => input.current?.click()}>{busy === "upload" ? "Uploading…" : "Upload GLB"}</button>
      <input ref={input} type="file" accept=".glb,model/gltf-binary" hidden onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file) void uploadGlb(file);
      }} />
      <button type="button" disabled={busy !== null} onClick={() => void exportScene()}>{busy === "export" ? "Exporting…" : "Export Scene"}</button>
      <p>Export Scene downloads a JSON snapshot of public values visible to the Explorer. Babylon Lite does not currently expose public GLB scene serialization.</p>
    </section>
  </div>;
}
