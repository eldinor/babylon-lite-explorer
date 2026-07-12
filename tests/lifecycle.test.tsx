import { expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/preact";
import { showLiteExplorer } from "../src/api/showLiteExplorer";
import { createInstancerExplorerAdapter } from "../src/adapter/instancer/createInstancerExplorerAdapter";
import type { LiteSceneAdapter } from "../src/adapter/LiteSceneAdapter";
import { fakeScene } from "./helpers";
import packageJson from "../package.json";

it("mounts independent instances and disposes idempotently", async () => {
  vi.useFakeTimers();
  const data = fakeScene();
  const first = showLiteExplorer({ scene: data.scene, engine: {} });
  const second = showLiteExplorer({ scene: data.scene, engine: {} }, { theme: "light" });
  await first.ready;
  await second.ready;
  expect(document.querySelectorAll(".ble-root")).toHaveLength(2);
  expect(document.querySelector(".ble-root")?.getAttribute("data-layout")).toBe("single");
  expect(document.querySelector(".ble-root")?.querySelectorAll(".ble-single-stack > .ble-pane")).toHaveLength(2);
  expect(document.querySelector(".ble-toolbar strong")?.textContent).toBe(`Babylon Lite 1.10.0 Explorer ${packageJson.version}`);
  expect([...document.querySelector(".ble-root")!.querySelectorAll<HTMLButtonElement>('.ble-tabs button[role="tab"]')].map((item) => item.textContent)).toEqual(["Scene Explorer", "Properties", "Tools"]);
  first.hide(); first.show(); first.toggle(); first.toggle();
  first.dispose(); first.dispose();
  expect(document.querySelectorAll(".ble-root")).toHaveLength(1);
  second.dispose();
  expect(document.querySelectorAll(".ble-root")).toHaveLength(0);
  vi.useRealTimers();
});

it("supports the split two-column layout", async () => {
  vi.useFakeTimers();
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} }, { layout: "split" });
  await handle.ready;
  expect(document.querySelector(".ble-root")?.getAttribute("data-layout")).toBe("split");
  expect(document.querySelector(".ble-split-dock-left .ble-pane-left")).not.toBeNull();
  expect(document.querySelector(".ble-split-dock-right .ble-pane-right")).not.toBeNull();
  handle.dispose();
  vi.useRealTimers();
});

it("opens Tools after Properties", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;
  const tools = [...document.querySelectorAll<HTMLButtonElement>('.ble-tabs button[role="tab"]')]
    .find((button) => button.textContent === "Tools");
  tools?.click();
  await waitFor(() => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".ble-tools button")].map((button) => button.textContent);
    expect(buttons).toEqual(["Upload GLB", "Export Scene"]);
  });
  expect(document.querySelector<HTMLInputElement>('.ble-tools input[type="file"]')?.accept).toContain(".glb");
  handle.dispose();
});

it("switches layouts from the header without refresh or hide controls", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;
  const headerLabels = [...document.querySelectorAll<HTMLButtonElement>(".ble-toolbar-actions button")].map((button) => button.textContent);
  expect(headerLabels).toEqual(["Split", "Light", "Hide", "×"]);
  expect(headerLabels).not.toContain("Refresh");
  document.querySelector<HTMLButtonElement>(".ble-toolbar-actions button")?.click();
  expect(document.querySelector(".ble-root")?.getAttribute("data-layout")).toBe("split");
  await waitFor(() => expect(document.querySelector<HTMLButtonElement>(".ble-toolbar-actions button")?.textContent).toBe("Single"));
  handle.dispose();
});

it("hides from the title bar, restores by shortcut, and disposes separately", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;

  document.querySelector<HTMLButtonElement>('button[title="Hide Explorer (Ctrl+Shift+E)"]')?.click();
  expect(document.querySelector<HTMLElement>(".ble-root")?.hidden).toBe(true);

  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, bubbles: true }));
  expect(document.querySelector<HTMLElement>(".ble-root")?.hidden).toBe(false);

  const disposeButton = document.querySelector<HTMLButtonElement>('button[aria-label="Dispose explorer permanently"]');
  expect(disposeButton?.classList.contains("ble-dispose")).toBe(true);
  disposeButton?.click();
  expect(document.querySelector(".ble-root")).toBeNull();
});

it("toggles and persists theme from the header", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;
  const themeButton = [...document.querySelectorAll<HTMLButtonElement>(".ble-toolbar-actions button")].find((button) => button.textContent === "Light");
  themeButton?.click();
  expect(document.querySelector(".ble-root")?.getAttribute("data-theme")).toBe("light");
  expect(localStorage.getItem("ble.theme")).toBe("light");
  handle.dispose();
});

it("supports lifecycle-safe keyboard shortcuts", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyL", ctrlKey: true, shiftKey: true, bubbles: true }));
  expect(document.querySelector(".ble-root")?.getAttribute("data-layout")).toBe("split");
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyY", ctrlKey: true, shiftKey: true, bubbles: true }));
  expect(document.querySelector(".ble-root")?.getAttribute("data-theme")).toBe("light");
  handle.dispose();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyL", ctrlKey: true, shiftKey: true, bubbles: true }));
  expect(document.querySelector(".ble-root")).toBeNull();
});

it("links the footer logo to BabylonPress", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;

  const link = document.querySelector<HTMLAnchorElement>(".ble-footer-logo");
  expect(link?.closest(".ble-links-footer")).not.toBeNull();
  expect(link?.closest(".ble-pane-left, .ble-pane-single-left")).not.toBeNull();
  expect(document.querySelector(".ble-status .ble-footer-logo")).toBeNull();
  expect(document.querySelector(".ble-properties-footer")?.childElementCount).toBe(0);
  expect(link?.href).toBe("https://babylonpress.org/");
  expect(link?.target).toBe("_blank");
  expect(link?.querySelector("img")?.alt).toBe("BabylonPress");
  const help = document.querySelector<HTMLAnchorElement>(".ble-footer-help");
  expect(help?.href).toBe("https://github.com/eldinor/babylon-lite-explorer/blob/main/docs/user-guide.md");
  expect(help?.textContent).toBe("?");
  const github = document.querySelector<HTMLAnchorElement>(".ble-footer-github");
  expect(github?.href).toBe("https://github.com/eldinor/babylon-lite-explorer");
  expect(github?.getAttribute("aria-label")).toBe("Babylon Lite Explorer on GitHub");
  expect(github?.querySelector("svg")).not.toBeNull();
  handle.dispose();

  const custom = showLiteExplorer({ scene: data.scene, engine: {} }, { userGuideUrl: "https://example.com/guide" });
  await custom.ready;
  expect(document.querySelector<HTMLAnchorElement>(".ble-footer-help")?.href).toBe("https://example.com/guide");
  custom.dispose();
});

it("opens Animation Groups from the Properties footer", async () => {
  vi.useFakeTimers();
  const capabilities = { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: false };
  const animations = { id: "section:animations", label: "Animation Groups", kind: "unknown" as const, source: {}, capabilities, children: [
    { id: "animation:walk", label: "Walk", kind: "animationGroup" as const, source: {}, capabilities }
  ] };
  const scene = { id: "scene:root", label: "Scene", kind: "scene" as const, source: {}, capabilities, children: [animations] };
  const adapter = {
    getSceneTree: () => [scene],
    getProperties: () => [],
    getStats: () => ({ animationGroupCount: 1 })
  };
  const handle = showLiteExplorer({ scene: {}, engine: {} }, { adapter });
  await handle.ready;
  await vi.advanceTimersByTimeAsync(500);

  const button = [...document.querySelectorAll<HTMLButtonElement>(".ble-properties-footer button")]
    .find((item) => item.textContent === "Animation Groups 1");
  button?.click();
  await Promise.resolve();

  expect(button).toBeDefined();
  expect(document.querySelector(".ble-tree-row.is-selected .ble-tree-label")?.textContent).toBe("Animation Groups");
  handle.dispose();
  vi.useRealTimers();
});

it("appends generic adapters after the default adapter", async () => {
  const data = fakeScene();
  const capabilities = { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: false };
  const extraEntity = { id: "extra:root", label: "Instancer", kind: "unknown" as const, source: {}, capabilities };
  const extraAdapter: LiteSceneAdapter = {
    getSceneTree: () => [extraEntity],
    getProperties: () => [{ kind: "readonly", path: "kind", label: "Adapter", value: "Instancer", section: "General" }]
  };
  const handle = showLiteExplorer({ scene: data.scene, engine: {} }, { adapters: [extraAdapter] });
  await handle.ready;

  expect([...document.querySelectorAll<HTMLButtonElement>(".ble-tree-label")].map((button) => button.textContent)).toEqual(expect.arrayContaining(["Scene", "Instancer"]));
  [...document.querySelectorAll<HTMLButtonElement>(".ble-tree-label")].find((button) => button.textContent === "Instancer")?.click();
  await waitFor(() => {
    expect([...document.querySelectorAll<HTMLLabelElement>(".ble-property-row > label")].map((label) => label.textContent)).toContain("Adapter");
  });

  handle.dispose();
});

it("registers custom panes and command-backed row actions", async () => {
  const entity = {
    id: "custom",
    label: "Custom mesh",
    kind: "mesh" as const,
    source: {},
    capabilities: { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: false }
  };
  const adapter: LiteSceneAdapter = { getSceneTree: () => [entity], getProperties: () => [] };
  const handle = showLiteExplorer({ scene: {}, engine: {} }, {
    adapter,
    panes: [{ key: "custom-pane", title: "Custom", content: () => <div class="custom-pane-content">Custom panel</div> }],
    commands: [{
      id: "open-custom",
      label: "Open custom",
      when: (row) => row?.id === "custom",
      rowAction: { label: "Open custom", icon: "I" },
      run: (_row, _context, api) => api.openPanel("custom-pane")
    }]
  });
  await handle.ready;

  expect([...document.querySelectorAll<HTMLButtonElement>('.ble-tabs button[role="tab"]')].map((button) => button.textContent)).toContain("Custom");
  document.querySelector<HTMLButtonElement>('[aria-label="Open custom Custom mesh"]')?.click();

  await waitFor(() => {
    const customTab = [...document.querySelectorAll<HTMLButtonElement>('.ble-tabs button[role="tab"]')]
      .find((button) => button.textContent === "Custom");
    expect(customTab?.getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector(".custom-pane-content")?.textContent).toBe("Custom panel");
  });
  handle.dispose();
});

it("opens the Instancer panel from a registered source mesh row action", async () => {
  const data = fakeScene();
  const instancerAdapter = createInstancerExplorerAdapter();
  const saveSet = vi.fn();
  const set = {
    count: 2,
    capacity: 4,
    visibleCount: 2,
    mesh: data.mesh,
    entries: () => [
      { id: 1, slot: 0, metadata: { label: "First stable instance" } },
      { id: 2, slot: 1, metadata: { label: "Second stable instance" } }
    ],
    getMetadata: (id: number) => id === 1 ? { label: "First stable instance" } : { label: "Second stable instance" },
    getVisible: () => true,
    setVisible: vi.fn(),
    getPosition: (id: number) => id === 1 ? [1, 2, 3] : [4, 5, 6],
    setTransform: vi.fn(),
    setScale: vi.fn(),
    getColor: (id: number) => id === 1 ? [1, 0, 0, 1] : [0, 0, 1, 1],
    setColor: vi.fn(),
    getClip: () => "Idle",
    getMatrix: (id: number) => id === 1
      ? [1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 3, 0, 1, 2, 3, 1]
      : [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 4, 5, 6, 1]
  };
  instancerAdapter.register(set, { label: "Sphere instances", saveSet });
  expect(instancerAdapter.exportSet(set)).toMatchObject({
    label: "Sphere instances",
    instances: [
      { id: 1, slot: 0, label: "First stable instance", visible: true, position: [1, 2, 3], scale: [1, 2, 3], color: [1, 0, 0, 1], clip: "Idle" },
      { id: 2, slot: 1, label: "Second stable instance", visible: true, position: [4, 5, 6], scale: [2, 2, 2], color: [0, 0, 1, 1], clip: "Idle" }
    ]
  });
  const directInstance = (await instancerAdapter.getExtensionEntities?.({ scene: data.scene, engine: {} }) ?? [])
    .flatMap((entity) => entity.children ?? [])
    .flatMap((entity) => entity.children ?? [])
    .find((entity) => entity.label === "First stable instance")!;
  await instancerAdapter.setProperty?.(directInstance, "rotationEuler", [0.25, 0, 0], { scene: data.scene, engine: {} });
  expect(instancerAdapter.getProperties(directInstance, { scene: data.scene, engine: {} }))
    .toEqual(expect.arrayContaining([expect.objectContaining({ path: "rotationEuler", value: [0.25, 0, 0] })]));
  await instancerAdapter.setProperty?.(directInstance, "rotationEuler", [0, 0, 0], { scene: data.scene, engine: {} });

  const handle = showLiteExplorer({ scene: data.scene, engine: {} }, { adapters: [instancerAdapter] });
  await handle.ready;

  document.querySelector<HTMLButtonElement>('[aria-label="Show instances Sphere"]')?.click();

  await waitFor(() => {
    const instancerTab = [...document.querySelectorAll<HTMLButtonElement>('.ble-tabs button[role="tab"]')]
      .find((button) => button.textContent === "Instancer");
    expect(instancerTab?.getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector(".ble-instancer-panel")?.textContent).toContain("Sphere");
    expect(document.querySelector(".ble-instancer-panel")?.textContent).toContain("Sphere instances");
    expect(document.querySelector(".ble-instancer-panel")?.textContent).toContain("First stable instance");
  });
  [...document.querySelectorAll<HTMLButtonElement>(".ble-instancer-tree-label")]
    .find((button) => button.textContent === "First stable instance")
    ?.click();
  await waitFor(() => {
    expect(document.querySelector(".ble-selection-title")?.textContent).toBe("First stable instance");
    const labels = [...document.querySelectorAll<HTMLLabelElement>(".ble-property-row > label")].map((label) => label.textContent);
    expect(labels).toEqual(expect.arrayContaining(["Instance ID", "Current slot", "Visible", "Position", "Rotation", "Scaling", "Color", "Clip", "Metadata"]));
  });
  const rotationX = document.querySelector<HTMLInputElement>('input[aria-label="Rotation X"]');
  const rotationY = document.querySelector<HTMLInputElement>('input[aria-label="Rotation Y"]');
  const rotationZ = document.querySelector<HTMLInputElement>('input[aria-label="Rotation Z"]');
  expect(rotationX?.value).toBe("0");
  expect(rotationY?.value).toBe("0");
  expect(rotationZ?.value).toBe("0");
  fireEvent.focus(rotationX!);
  fireEvent.input(rotationX!, { target: { value: "0.5" } });
  await waitFor(() => {
    expect(set.setTransform).toHaveBeenCalledWith(1, expect.objectContaining({ rotationEuler: [0.5, 0, 0] }));
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Rotation X"]')?.value).toBe("0.5");
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Rotation Y"]')?.value).toBe("0");
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Rotation Z"]')?.value).toBe("0");
  });
  fireEvent.blur(rotationX!);
  const colorY = document.querySelector<HTMLInputElement>('input[aria-label="Color Y"]');
  expect(colorY?.value).toBe("0");
  fireEvent.focus(colorY!);
  fireEvent.input(colorY!, { target: { value: "0.75" } });
  await waitFor(() => {
    expect(set.setColor).toHaveBeenCalledWith(1, [1, 0.75, 0, 1]);
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Color X"]')?.value).toBe("1");
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Color Y"]')?.value).toBe("0.75");
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Color Z"]')?.value).toBe("0");
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Color W"]')?.value).toBe("1");
  });
  [...document.querySelectorAll<HTMLButtonElement>(".ble-instancer-tree-label")]
    .find((button) => button.textContent === "Sphere instances")
    ?.click();
  await waitFor(() => expect(document.querySelector(".ble-selection-title")?.textContent).toBe("Sphere instances"));
  [...document.querySelectorAll<HTMLButtonElement>(".ble-selection-actions button")]
    .find((button) => button.textContent === "Save Set")
    ?.click();
  await waitFor(() => expect(saveSet).toHaveBeenCalledWith(expect.objectContaining({ label: "Sphere instances" })));
  handle.dispose();
});

it("can disable keyboard shortcuts", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer(
    { scene: data.scene, engine: {} },
    { keyboardShortcutsEnabled: false }
  );
  await handle.ready;
  const root = document.querySelector<HTMLElement>(".ble-root");

  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyL", ctrlKey: true, shiftKey: true, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, bubbles: true }));

  expect(root?.dataset.layout).toBe("single");
  expect(root?.hidden).toBe(false);
  handle.dispose();
});

it("restores persisted compact pane proportions", async () => {
  vi.useFakeTimers();
  localStorage.setItem("ble.singlePanePercent", "60");
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;
  expect(document.querySelector<HTMLElement>(".ble-single-stack")?.style.gridTemplateRows).toContain("60%");
  handle.dispose();
  vi.useRealTimers();
});

it("shows capability-backed actions for the selected entity", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;
  const sphere = [...document.querySelectorAll<HTMLButtonElement>(".ble-tree-label")].find((button) => button.textContent?.includes("Sphere"));
  const rowDelete = [...document.querySelectorAll<HTMLButtonElement>(".ble-tree-action.is-danger")]
    .find((button) => button.getAttribute("aria-label") === "Delete Sphere");
  expect(rowDelete?.textContent).toBe("x");
  sphere?.click();
  await waitFor(() => {
    const labels = [...document.querySelectorAll<HTMLButtonElement>(".ble-selection-actions button")].map((button) => button.textContent);
    expect(labels).toEqual(["Copy", "Visible", "Delete"]);
  });
  handle.dispose();
});

it("deletes a selected removable entity without confirmation by default", async () => {
  const data = fakeScene();
  const confirm = vi.spyOn(window, "confirm");
  const removeFromScene = vi.fn((scene: typeof data.scene, entity: unknown) => {
    scene.meshes = scene.meshes.filter((mesh) => mesh !== entity);
  });
  const handle = showLiteExplorer(
    { scene: data.scene, engine: {}, lite: { removeFromScene } as unknown as import("../src/api/types").LiteExplorerRuntime }
  );
  await handle.ready;
  const sphere = [...document.querySelectorAll<HTMLButtonElement>(".ble-tree-label")].find((button) => button.textContent?.includes("Sphere"));
  sphere?.click();

  await waitFor(() => expect(document.querySelector(".ble-selection-status strong")?.textContent).toBe("Sphere"));
  [...document.querySelectorAll<HTMLButtonElement>(".ble-selection-actions button")]
    .find((button) => button.textContent === "Delete")
    ?.click();

  await waitFor(() => expect(removeFromScene).toHaveBeenCalledWith(data.scene, data.mesh));
  expect(confirm).not.toHaveBeenCalled();
  await waitFor(() => {
    expect(document.querySelector(".ble-selection-status strong")).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>(".ble-tree-label")].some((button) => button.textContent?.includes("Sphere"))).toBe(false);
  });

  handle.dispose();
  confirm.mockRestore();
});

it("can ask before deleting a removable entity", async () => {
  const data = fakeScene();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const removeFromScene = vi.fn();
  const handle = showLiteExplorer(
    { scene: data.scene, engine: {}, lite: { removeFromScene } as unknown as import("../src/api/types").LiteExplorerRuntime },
    { confirmEntityRemoval: true }
  );
  await handle.ready;
  const sphere = [...document.querySelectorAll<HTMLButtonElement>(".ble-tree-label")].find((button) => button.textContent?.includes("Sphere"));
  sphere?.click();

  await waitFor(() => expect(document.querySelector(".ble-selection-status strong")?.textContent).toBe("Sphere"));
  [...document.querySelectorAll<HTMLButtonElement>(".ble-selection-actions button")]
    .find((button) => button.textContent === "Delete")
    ?.click();

  expect(confirm).toHaveBeenCalledWith('Delete "Sphere" from the scene?');
  expect(removeFromScene).not.toHaveBeenCalled();

  handle.dispose();
  confirm.mockRestore();
});

it("shows public scene settings when Scene is selected", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;

  const scene = [...document.querySelectorAll<HTMLButtonElement>(".ble-tree-label")]
    .find((button) => button.textContent?.trim() === "Scene");
  scene?.click();

  await waitFor(() => {
    const labels = [...document.querySelectorAll<HTMLLabelElement>(".ble-property-row > label")]
      .map((label) => label.textContent);
    expect(labels).toEqual(expect.arrayContaining([
      "Clear color",
      "Exposure",
      "Contrast",
      "Tone mapping",
      "Tone mapping type",
      "Environment primary color",
      "Environment Y rotation"
    ]));
  });
  expect(document.querySelector<HTMLInputElement>('.ble-property-control input[type="checkbox"]')?.checked).toBe(false);
  expect(document.querySelector<HTMLSelectElement>(".ble-property-control select")?.value).toBe("standard");
  handle.dispose();
});

it("applies property input without waiting for blur", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;
  const sphere = [...document.querySelectorAll<HTMLButtonElement>(".ble-tree-label")].find((button) => button.textContent?.includes("Sphere"));
  sphere?.click();
  const nameInput = await waitFor(() => {
    const input = document.querySelector<HTMLInputElement>('.ble-property-control input[type="text"]');
    expect(input).not.toBeNull();
    return input!;
  });
  nameInput.focus();
  nameInput.value = "Renamed immediately";
  nameInput.dispatchEvent(new Event("input", { bubbles: true }));
  await waitFor(() => expect(data.mesh.name).toBe("Renamed immediately"));
  expect(document.activeElement).toBe(nameInput);
  handle.dispose();
});

it("applies the Visible checkbox", async () => {
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;
  const sphere = [...document.querySelectorAll<HTMLButtonElement>(".ble-tree-label")].find((button) => button.textContent?.includes("Sphere"));
  sphere?.click();
  const checkbox = await waitFor(() => {
    const input = document.querySelector<HTMLInputElement>('.ble-property-control input[type="checkbox"]');
    expect(input).not.toBeNull();
    return input!;
  });

  checkbox.click();
  await waitFor(() => expect(data.mesh.visible).toBe(false));
  expect(checkbox.checked).toBe(false);
  handle.dispose();
});

it("keeps camera focus opt-in even for a focus-capable adapter", async () => {
  const entity = {
    id: "focusable",
    label: "Focusable mesh",
    kind: "mesh" as const,
    source: {},
    capabilities: { editable: false, focusable: true, visibilityToggle: false, serializableSnapshot: false }
  };
  const adapter: LiteSceneAdapter = {
    getSceneTree: () => [entity],
    getProperties: () => [],
    focusEntity: () => ({ ok: true, value: undefined })
  };
  const disabled = showLiteExplorer({ scene: {}, engine: {} }, { adapter });
  await disabled.ready;
  document.querySelector<HTMLButtonElement>(".ble-tree-label")?.click();
  await waitFor(() => expect(document.querySelector(".ble-selection-status strong")?.textContent).toBe("Focusable mesh"));
  expect([...document.querySelectorAll(".ble-selection-actions button")].some((button) => button.textContent === "Focus")).toBe(false);
  disabled.dispose();

  const enabled = showLiteExplorer({ scene: {}, engine: {} }, { adapter, features: { focusSelected: true } });
  await enabled.ready;
  document.querySelector<HTMLButtonElement>(".ble-tree-label")?.click();
  await waitFor(() => expect([...document.querySelectorAll(".ble-selection-actions button")].some((button) => button.textContent === "Focus")).toBe(true));
  enabled.dispose();
});

it("selects a picked entity, ignores drags, and removes canvas listeners", async () => {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const entity = {
    id: "picked",
    label: "Picked mesh",
    kind: "mesh" as const,
    source: {},
    capabilities: { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: false }
  };
  const pickEntityId = vi.fn(() => ({ ok: true as const, value: "picked" }));
  const adapter: LiteSceneAdapter = { getSceneTree: () => [entity], getProperties: () => [], pickEntityId };
  const handle = showLiteExplorer({ scene: {}, engine: {}, canvas }, { adapter, features: { canvasPicking: true } });
  await handle.ready;
  const pointer = (type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, {
      pointerId: { value: 1 },
      pointerType: { value: "mouse" },
      isPrimary: { value: true }
    });
    canvas.dispatchEvent(event);
  };
  const pickButton = document.querySelector<HTMLButtonElement>(".ble-pick-toggle");
  expect(pickButton?.textContent).toBe("Pick: Off");
  expect(pickButton?.getAttribute("aria-pressed")).toBe("false");
  pointer("pointerdown", 20, 30);
  pointer("pointerup", 20, 30);
  expect(pickEntityId).not.toHaveBeenCalled();
  pickButton?.click();
  await waitFor(() => expect(document.querySelector(".ble-pick-toggle")?.textContent).toBe("Pick: On"));
  pointer("pointerdown", 20, 30);
  pointer("pointerup", 20, 30);
  await waitFor(() => expect(document.querySelector(".ble-selection-status strong")?.textContent).toBe("Picked mesh"));
  expect(pickEntityId).toHaveBeenCalledWith(20, 30, expect.anything());

  pointer("pointerdown", 0, 0);
  pointer("pointerup", 20, 20);
  expect(pickEntityId).toHaveBeenCalledTimes(1);
  handle.dispose();
  pointer("pointerdown", 20, 30);
  pointer("pointerup", 20, 30);
  expect(pickEntityId).toHaveBeenCalledTimes(1);
});

it("virtualizes a large expanded Scene Explorer", async () => {
  const data = fakeScene();
  data.scene.meshes = Array.from({ length: 10_000 }, (_, index) => ({
    ...data.mesh,
    id: `mesh-${index}`,
    name: `Mesh ${index}`,
    children: [],
    position: { ...data.mesh.position },
    rotation: { ...data.mesh.rotation },
    scaling: { ...data.mesh.scaling }
  }));
  const handle = showLiteExplorer({ scene: data.scene, engine: {} });
  await handle.ready;
  await waitFor(() => expect(document.querySelectorAll(".ble-tree-row").length).toBeGreaterThan(5));
  expect(document.querySelectorAll(".ble-tree-row").length).toBeLessThan(50);
  expect(document.querySelector<HTMLElement>(".ble-tree-virtual")?.style.height).toBe(`${(10_000 + 5) * 25}px`);
  const scroller = document.querySelector<HTMLElement>(".ble-tree-scroll")!;
  scroller.scrollTop = 125_000;
  scroller.dispatchEvent(new Event("scroll"));
  await waitFor(() => expect(document.querySelector("[data-tree-index=\"5000\"]")).not.toBeNull());
  expect(document.querySelector("[data-tree-index=\"1\"]")).toBeNull();
  handle.dispose();
});

it("restores container positioning", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const data = fakeScene();
  const handle = showLiteExplorer({ scene: data.scene, engine: {} }, { container });
  await handle.ready;
  expect(container.style.position).toBe("relative");
  handle.dispose();
  expect(container.style.position).toBe("");
  vi.useRealTimers();
});
