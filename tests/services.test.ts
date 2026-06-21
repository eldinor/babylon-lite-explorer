import { describe, expect, it, vi } from "vitest";
import { createExplorerSignals } from "../src/signals/createExplorerSignals";
import { NotificationService } from "../src/services/notificationService";
import { RefreshController } from "../src/services/refreshController";
import { ShellService } from "../src/services/shellService";

const capabilities = { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: false };

describe("services", () => {
  it("auto-dismisses notifications after the configured duration", () => {
    vi.useFakeTimers();
    const signals = createExplorerSignals();
    const notifications = new NotificationService(signals, 3000);
    notifications.push("Temporary message", "info");
    expect(signals.notifications.value).toHaveLength(1);
    vi.advanceTimersByTime(2999);
    expect(signals.notifications.value).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(signals.notifications.value).toHaveLength(0);
    notifications.dispose();
    vi.useRealTimers();
  });

  it("supports persistent manually-dismissed notifications", () => {
    vi.useFakeTimers();
    const signals = createExplorerSignals();
    const notifications = new NotificationService(signals, 0);
    notifications.push("Persistent message");
    vi.advanceTimersByTime(10_000);
    expect(signals.notifications.value).toHaveLength(1);
    notifications.dismiss(signals.notifications.value[0].id);
    expect(signals.notifications.value).toHaveLength(0);
    notifications.dispose();
    vi.useRealTimers();
  });

  it("can disable notifications completely", () => {
    vi.useFakeTimers();
    const signals = createExplorerSignals();
    const notifications = new NotificationService(signals, 3000, false);
    notifications.push("Hidden error");
    notifications.push("Hidden info", "info");
    vi.advanceTimersByTime(3000);
    expect(signals.notifications.value).toEqual([]);
    notifications.dispose();
    vi.useRealTimers();
  });

  it("registers and disposes panes deterministically", () => {
    const signals = createExplorerSignals();
    const shell = new ShellService(signals);
    const component = () => null;
    const later = shell.addSidePane({ key: "z", title: "Z", side: "left", order: 20, content: component });
    shell.addSidePane({ key: "a", title: "A", side: "left", order: 10, content: component });
    expect(signals.panes.value.map((pane) => pane.key)).toEqual(["a", "z"]);
    later.dispose();
    expect(signals.panes.value.map((pane) => pane.key)).toEqual(["a"]);
  });

  it("registers and disposes toolbar items", () => {
    const signals = createExplorerSignals();
    const shell = new ShellService(signals);
    const disposable = shell.addToolbarItem({ key: "refresh", location: "top-right", component: () => null });
    expect(signals.toolbarItems.value).toHaveLength(1);
    disposable.dispose();
    expect(signals.toolbarItems.value).toHaveLength(0);
  });

  it("preserves or clears selection across tree refresh", async () => {
    const signals = createExplorerSignals();
    let present = true;
    signals.context.value = { scene: {}, engine: {} };
    signals.adapter.value = {
      getSceneTree: () => present ? [{ id: "one", label: "One", kind: "mesh", source: {}, capabilities }] : [],
      getProperties: () => []
    };
    const controller = new RefreshController(signals, new NotificationService(signals));
    signals.selectedEntityId.value = "one";
    await controller.refreshTree();
    expect(signals.selectedEntityId.value).toBe("one");
    present = false;
    await controller.refreshTree();
    expect(signals.selectedEntityId.value).toBeNull();
  });

  it("rejects stale property responses", async () => {
    const signals = createExplorerSignals();
    signals.context.value = { scene: {}, engine: {} };
    const resolvers: Array<(value: never[]) => void> = [];
    signals.adapter.value = {
      getSceneTree: () => [],
      getProperties: () => new Promise((resolve) => resolvers.push(resolve))
    };
    signals.tree.value = [
      { id: "one", label: "One", kind: "mesh", source: {}, capabilities },
      { id: "two", label: "Two", kind: "mesh", source: {}, capabilities }
    ];
    const controller = new RefreshController(signals, new NotificationService(signals));
    const first = controller.select("one");
    const second = controller.select("two");
    resolvers[0]([]); await first;
    resolvers[1]([]); await second;
    expect(signals.selectedEntityId.value).toBe("two");
  });

  it("does not optimistically apply rejected writes", async () => {
    const signals = createExplorerSignals();
    signals.context.value = { scene: {}, engine: {} };
    signals.tree.value = [{ id: "one", label: "One", kind: "mesh", source: {}, capabilities }];
    signals.selectedEntityId.value = "one";
    signals.properties.value = [{ kind: "number", path: "value", label: "Value", value: 2 }];
    signals.adapter.value = { getSceneTree: () => signals.tree.value, getProperties: () => signals.properties.value, setProperty: vi.fn(() => ({ ok: false as const, code: "invalid" as const, message: "Nope" })) };
    const controller = new RefreshController(signals, new NotificationService(signals));
    expect(await controller.setProperty(signals.properties.value[0], 8)).toBe(false);
    expect(signals.properties.value[0]).toMatchObject({ value: 2 });
    expect(signals.notifications.value[0].message).toBe("Nope");
  });
});
