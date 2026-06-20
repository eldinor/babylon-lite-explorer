import { expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/preact";
import { showLiteInspector } from "../src/api/showLiteInspector";
import type { LiteSceneAdapter } from "../src/adapter/LiteSceneAdapter";
import { fakeScene } from "./helpers";

it("mounts independent instances and disposes idempotently", async () => {
  vi.useFakeTimers();
  const data = fakeScene();
  const first = showLiteInspector({ scene: data.scene, engine: {} });
  const second = showLiteInspector({ scene: data.scene, engine: {} }, { theme: "light" });
  await first.ready;
  await second.ready;
  expect(document.querySelectorAll(".bli-root")).toHaveLength(2);
  expect(document.querySelector(".bli-root")?.getAttribute("data-layout")).toBe("single");
  expect(document.querySelector(".bli-root")?.querySelectorAll(".bli-single-stack > .bli-pane")).toHaveLength(2);
  expect([...document.querySelector(".bli-root")!.querySelectorAll(".bli-pane-heading")].map((item) => item.textContent)).toEqual(["Scene Explorer", "Properties"]);
  first.hide(); first.show(); first.toggle(); first.toggle();
  first.dispose(); first.dispose();
  expect(document.querySelectorAll(".bli-root")).toHaveLength(1);
  second.dispose();
  expect(document.querySelectorAll(".bli-root")).toHaveLength(0);
  vi.useRealTimers();
});

it("supports the split two-column layout", async () => {
  vi.useFakeTimers();
  const data = fakeScene();
  const handle = showLiteInspector({ scene: data.scene, engine: {} }, { layout: "split" });
  await handle.ready;
  expect(document.querySelector(".bli-root")?.getAttribute("data-layout")).toBe("split");
  expect(document.querySelector(".bli-split-dock-left .bli-pane-left")).not.toBeNull();
  expect(document.querySelector(".bli-split-dock-right .bli-pane-right")).not.toBeNull();
  handle.dispose();
  vi.useRealTimers();
});

it("switches layouts from the header without refresh or hide controls", async () => {
  const data = fakeScene();
  const handle = showLiteInspector({ scene: data.scene, engine: {} });
  await handle.ready;
  const headerLabels = [...document.querySelectorAll<HTMLButtonElement>(".bli-toolbar-actions button")].map((button) => button.textContent);
  expect(headerLabels).toEqual(["Split", "Light", "×"]);
  expect(headerLabels).not.toContain("Refresh");
  expect(headerLabels).not.toContain("Hide");
  document.querySelector<HTMLButtonElement>(".bli-toolbar-actions button")?.click();
  expect(document.querySelector(".bli-root")?.getAttribute("data-layout")).toBe("split");
  await waitFor(() => expect(document.querySelector<HTMLButtonElement>(".bli-toolbar-actions button")?.textContent).toBe("Single"));
  handle.dispose();
});

it("toggles and persists theme from the header", async () => {
  const data = fakeScene();
  const handle = showLiteInspector({ scene: data.scene, engine: {} });
  await handle.ready;
  const themeButton = [...document.querySelectorAll<HTMLButtonElement>(".bli-toolbar-actions button")].find((button) => button.textContent === "Light");
  themeButton?.click();
  expect(document.querySelector(".bli-root")?.getAttribute("data-theme")).toBe("light");
  expect(localStorage.getItem("bli.theme")).toBe("light");
  handle.dispose();
});

it("supports lifecycle-safe keyboard shortcuts", async () => {
  const data = fakeScene();
  const handle = showLiteInspector({ scene: data.scene, engine: {} });
  await handle.ready;
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyL", ctrlKey: true, shiftKey: true, bubbles: true }));
  expect(document.querySelector(".bli-root")?.getAttribute("data-layout")).toBe("split");
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyY", ctrlKey: true, shiftKey: true, bubbles: true }));
  expect(document.querySelector(".bli-root")?.getAttribute("data-theme")).toBe("light");
  handle.dispose();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyL", ctrlKey: true, shiftKey: true, bubbles: true }));
  expect(document.querySelector(".bli-root")).toBeNull();
});

it("restores persisted compact pane proportions", async () => {
  vi.useFakeTimers();
  localStorage.setItem("bli.singlePanePercent", "60");
  const data = fakeScene();
  const handle = showLiteInspector({ scene: data.scene, engine: {} });
  await handle.ready;
  expect(document.querySelector<HTMLElement>(".bli-single-stack")?.style.gridTemplateRows).toContain("60%");
  handle.dispose();
  vi.useRealTimers();
});

it("shows capability-backed actions for the selected entity", async () => {
  const data = fakeScene();
  const handle = showLiteInspector({ scene: data.scene, engine: {} });
  await handle.ready;
  const sphere = [...document.querySelectorAll<HTMLButtonElement>(".bli-tree-label")].find((button) => button.textContent?.includes("Sphere"));
  sphere?.click();
  await waitFor(() => {
    const labels = [...document.querySelectorAll<HTMLButtonElement>(".bli-selection-actions button")].map((button) => button.textContent);
    expect(labels).toEqual(["Copy", "Visible"]);
  });
  handle.dispose();
});

it("applies property input without waiting for blur", async () => {
  const data = fakeScene();
  const handle = showLiteInspector({ scene: data.scene, engine: {} });
  await handle.ready;
  const sphere = [...document.querySelectorAll<HTMLButtonElement>(".bli-tree-label")].find((button) => button.textContent?.includes("Sphere"));
  sphere?.click();
  const nameInput = await waitFor(() => {
    const input = document.querySelector<HTMLInputElement>('.bli-property-control input[type="text"]');
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
  const disabled = showLiteInspector({ scene: {}, engine: {} }, { adapter });
  await disabled.ready;
  document.querySelector<HTMLButtonElement>(".bli-tree-label")?.click();
  await waitFor(() => expect(document.querySelector(".bli-selection-status strong")?.textContent).toBe("Focusable mesh"));
  expect([...document.querySelectorAll(".bli-selection-actions button")].some((button) => button.textContent === "Focus")).toBe(false);
  disabled.dispose();

  const enabled = showLiteInspector({ scene: {}, engine: {} }, { adapter, features: { focusSelected: true } });
  await enabled.ready;
  document.querySelector<HTMLButtonElement>(".bli-tree-label")?.click();
  await waitFor(() => expect([...document.querySelectorAll(".bli-selection-actions button")].some((button) => button.textContent === "Focus")).toBe(true));
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
  const handle = showLiteInspector({ scene: {}, engine: {}, canvas }, { adapter, features: { canvasPicking: true } });
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
  const pickButton = document.querySelector<HTMLButtonElement>(".bli-pick-toggle");
  expect(pickButton?.textContent).toBe("Pick: Off");
  expect(pickButton?.getAttribute("aria-pressed")).toBe("false");
  pointer("pointerdown", 20, 30);
  pointer("pointerup", 20, 30);
  expect(pickEntityId).not.toHaveBeenCalled();
  pickButton?.click();
  await waitFor(() => expect(document.querySelector(".bli-pick-toggle")?.textContent).toBe("Pick: On"));
  pointer("pointerdown", 20, 30);
  pointer("pointerup", 20, 30);
  await waitFor(() => expect(document.querySelector(".bli-selection-status strong")?.textContent).toBe("Picked mesh"));
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
  const handle = showLiteInspector({ scene: data.scene, engine: {} });
  await handle.ready;
  await waitFor(() => expect(document.querySelectorAll(".bli-tree-row").length).toBeGreaterThan(5));
  expect(document.querySelectorAll(".bli-tree-row").length).toBeLessThan(50);
  expect(document.querySelector<HTMLElement>(".bli-tree-virtual")?.style.height).toBe(`${(10_000 + 5) * 25}px`);
  handle.dispose();
});

it("restores container positioning", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const data = fakeScene();
  const handle = showLiteInspector({ scene: data.scene, engine: {} }, { container });
  await handle.ready;
  expect(container.style.position).toBe("relative");
  handle.dispose();
  expect(container.style.position).toBe("");
  vi.useRealTimers();
});
