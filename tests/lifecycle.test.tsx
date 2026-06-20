import { expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/preact";
import { showLiteInspector } from "../src/api/showLiteInspector";
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
  expect(headerLabels).toEqual(["Split", "×"]);
  expect(headerLabels).not.toContain("Refresh");
  expect(headerLabels).not.toContain("Hide");
  document.querySelector<HTMLButtonElement>(".bli-toolbar-actions button")?.click();
  expect(document.querySelector(".bli-root")?.getAttribute("data-layout")).toBe("split");
  await waitFor(() => expect(document.querySelector<HTMLButtonElement>(".bli-toolbar-actions button")?.textContent).toBe("Single"));
  handle.dispose();
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
