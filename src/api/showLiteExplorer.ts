import { h, render } from "preact";
import { composeLiteSceneAdapters } from "../adapter/composeLiteSceneAdapters";
import { createDefaultLiteSceneAdapter } from "../adapter/default/createDefaultLiteSceneAdapter";
import { createDisposable, DisposableStore } from "../core/disposable";
import { createExplorerSignals } from "../signals/createExplorerSignals";
import { CommandService } from "../services/commandService";
import { NotificationService } from "../services/notificationService";
import { PickingService } from "../services/pickingService";
import { RefreshController } from "../services/refreshController";
import { ShellService } from "../services/shellService";
import { StatsService } from "../services/statsService";
import { App } from "../ui/App";
import { PropertiesPanel } from "../ui/PropertiesPanel";
import { SceneExplorer } from "../ui/SceneExplorer";
import { ToolsPanel } from "../ui/ToolsPanel";
import type { ExplorerRuntime } from "../ui/runtime";
import type { LiteExplorerContext, LiteExplorerHandle, LiteExplorerOptions } from "./types";

export function showLiteExplorer(context: LiteExplorerContext, options: LiteExplorerOptions = {}): LiteExplorerHandle {
  if (typeof document === "undefined") throw new Error("Babylon Lite Explorer requires a DOM environment.");
  const canvas = options.canvas ?? context.canvas;
  const container = options.container ?? canvas?.parentElement ?? document.body;
  const readPreference = (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const mode = options.mode ?? "overlay";
  const storedLayout = readPreference("ble.layout");
  const storedTheme = readPreference("ble.theme");
  const layout = options.layout ?? (storedLayout === "split" ? "split" : "single");
  const theme = options.theme ?? (storedTheme === "light" ? "light" : "dark");
  const host = document.createElement("div");
  host.className = `ble-root ble-${mode}`;
  host.dataset.theme = theme;
  host.dataset.layout = layout;
  host.hidden = options.initiallyOpen === false;
  container.appendChild(host);

  let restoredPosition: string | undefined;
  const containerPosition = mode === "overlay" && container !== document.body ? getComputedStyle(container).position : "";
  if (mode === "overlay" && container !== document.body && (!containerPosition || containerPosition === "static")) {
    restoredPosition = container.style.position;
    container.style.position = "relative";
  }

  const signals = createExplorerSignals();
  signals.context.value = { ...context, canvas };
  const baseAdapter = options.adapter ?? createDefaultLiteSceneAdapter();
  const extraAdapters = options.adapters ?? [];
  const adapter = extraAdapters.length ? composeLiteSceneAdapters([baseAdapter, ...extraAdapters]) : baseAdapter;
  signals.adapter.value = adapter;
  signals.theme.value = theme;
  signals.layout.value = layout;
  try {
    const singlePercent = Number(localStorage.getItem("ble.singlePanePercent"));
    if (singlePercent >= 25 && singlePercent <= 75) signals.singlePanePercent.value = singlePercent;
  } catch { /* storage may be unavailable in embedded or private contexts */ }
  signals.isOpen.value = options.initiallyOpen ?? true;
  const notifications = new NotificationService(
    signals,
    Math.max(0, options.notificationDurationMs ?? 3000),
    options.notificationsEnabled !== false
  );
  const focusSelectedEnabled = options.features?.focusSelected === true;
  const refresh = new RefreshController(signals, notifications);
  const shell = new ShellService(signals);
  const stats = new StatsService(signals);
  const picking = options.features?.canvasPicking === true && canvas
    ? new PickingService(canvas, signals, refresh, notifications)
    : undefined;
  signals.pickingAvailable.value = !!picking;
  const commands = new CommandService();
  const disposables = new DisposableStore();
  disposables.add(shell.addSidePane({ key: "scene-explorer", title: "Scene Explorer", side: "left", order: 10, content: SceneExplorer, keepMounted: true }));
  disposables.add(shell.addSidePane({ key: "properties", title: "Properties", side: "right", order: 10, content: PropertiesPanel, keepMounted: true }));
  disposables.add(shell.addSidePane({ key: "tools", title: "Tools", side: "right", order: 20, content: ToolsPanel }));
  disposables.add(commands.register({ id: "refresh", label: "Refresh", run: () => refresh.refreshTree() }));
  disposables.add(commands.register({ id: "clear-selection", label: "Clear selection", when: (entity) => !!entity, run: () => refresh.select(null) }));
  disposables.add(commands.register({
    id: "copy-entity-snapshot",
    label: "Copy entity snapshot",
    when: (entity) => !!entity?.capabilities.serializableSnapshot,
    run: async (entity, currentContext) => {
      const adapter = signals.adapter.value;
      if (!entity || !adapter?.getEntitySnapshot) return;
      const result = await adapter.getEntitySnapshot(entity, currentContext);
      if (!result.ok) { notifications.push(result.message); return; }
      try { await navigator.clipboard.writeText(JSON.stringify(result.value, null, 2)); }
      catch { notifications.push("Could not write the entity snapshot to the clipboard."); }
    }
  }));
  disposables.add(commands.register({
    id: "toggle-visible",
    label: "Toggle visible",
    when: (entity) => !!entity?.capabilities.visibilityToggle,
    run: async (entity, currentContext) => {
      const adapter = signals.adapter.value;
      if (!entity || !adapter?.setEntityVisible) return;
      const visible = signals.properties.value.find((item) => item.path === "visible");
      const result = await adapter.setEntityVisible(entity, !(visible?.kind === "boolean" && visible.value), currentContext);
      if (!result.ok) notifications.push(result.message); else await refresh.refreshTree();
    }
  }));
  disposables.add(commands.register({
    id: "remove-entity",
    label: "Delete",
    when: (entity) => !!entity?.capabilities.removable,
    run: async (entity, currentContext) => {
      const adapter = signals.adapter.value;
      if (!entity || !adapter?.removeEntity) return;
      const isActiveCamera = entity.kind === "camera" && currentContext.scene && typeof currentContext.scene === "object"
        && "camera" in currentContext.scene && currentContext.scene.camera === entity.source;
      const message = isActiveCamera
        ? `Delete active camera "${entity.label}"?`
        : `Delete "${entity.label}" from the scene?`;
      if (options.confirmEntityRemoval === true && !window.confirm(message)) return;
      const result = await adapter.removeEntity(entity, currentContext);
      if (!result.ok) { notifications.push(result.message); return; }
      if (signals.selectedEntityId.value === entity.id) await refresh.select(null);
      await refresh.refreshTree();
      notifications.push(`Deleted ${entity.label}`, "info");
    }
  }));
  disposables.add(commands.register({
    id: "focus-selected",
    label: "Focus selected",
    when: (entity) => focusSelectedEnabled && !!entity?.capabilities.focusable,
    run: async (entity, currentContext) => {
      const adapter = signals.adapter.value;
      if (!entity || !adapter?.focusEntity) return;
      const result = await adapter.focusEntity(entity, currentContext);
      if (!result.ok) notifications.push(result.message);
    }
  }));
  disposables.add(commands.register({
    id: "play-animation",
    label: "Play animation",
    when: (entity) => !!entity?.capabilities.animationPlayback,
    run: async (entity, currentContext) => {
      const adapter = signals.adapter.value;
      if (!entity || !adapter?.playAnimationGroup) return;
      const result = await adapter.playAnimationGroup(entity, currentContext);
      if (!result.ok) notifications.push(result.message); else await refresh.refreshProperties();
    }
  }));
  disposables.add(commands.register({
    id: "stop-animation",
    label: "Stop animation",
    when: (entity) => !!entity?.capabilities.animationPlayback,
    run: async (entity, currentContext) => {
      const adapter = signals.adapter.value;
      if (!entity || !adapter?.stopAnimationGroup) return;
      const result = await adapter.stopAnimationGroup(entity, currentContext);
      if (!result.ok) notifications.push(result.message); else await refresh.refreshTree();
    }
  }));

  let disposed = false;
  const runtime: ExplorerRuntime = {
    signals,
    refresh,
    notifications,
    commands,
    shell,
    userGuideUrl: options.userGuideUrl ?? "https://github.com/eldinor/babylon-lite-explorer/blob/main/docs/user-guide.md",
    setLayout(nextLayout) {
      signals.layout.value = nextLayout;
      host.dataset.layout = nextLayout;
      try { localStorage.setItem("ble.layout", nextLayout); } catch { /* optional persistence */ }
    },
    setTheme(nextTheme) {
      signals.theme.value = nextTheme;
      host.dataset.theme = nextTheme;
      try { localStorage.setItem("ble.theme", nextTheme); } catch { /* optional persistence */ }
    },
    setPickingActive(active) {
      if (!picking) return;
      if (active) picking.start(); else picking.stop();
      signals.pickingActive.value = active;
    },
    hide: () => handle.hide(),
    dispose: () => handle.dispose()
  };
  const defaultTitle = `Babylon Lite ${__BABYLON_LITE_VERSION__} Explorer ${__EXPLORER_VERSION__}`;
  const rerender = () => render(h(App, { runtime, title: options.title ?? defaultTitle }), host);
  rerender();
  stats.start();

  const ready = (async () => {
    const adapterResult = await signals.adapter.value?.refresh?.(signals.context.value!);
    if (adapterResult && !adapterResult.ok) notifications.push(adapterResult.message);
    await refresh.refreshTree();
    if (!signals.expandedIds.value.size) {
      const expanded = new Set<string>();
      for (const root of signals.tree.value) {
        expanded.add(root.id);
        for (const child of root.children ?? []) expanded.add(child.id);
      }
      signals.expandedIds.value = expanded;
    }
  })().catch((error) => {
    notifications.push(error instanceof Error ? error.message : "Explorer startup failed.");
    throw error;
  });

  const handle: LiteExplorerHandle = {
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      refresh.dispose();
      picking?.dispose();
      signals.pickingActive.value = false;
      stats.dispose();
      notifications.dispose();
      disposables.dispose();
      commands.dispose();
      if (extraAdapters.length) signals.adapter.value?.dispose?.();
      if (!options.adapter) baseAdapter.dispose?.();
      render(null, host);
      host.remove();
      if (restoredPosition !== undefined) container.style.position = restoredPosition;
    },
    show() { if (!disposed) { signals.isOpen.value = true; host.hidden = false; rerender(); } },
    hide() { if (!disposed) { runtime.setPickingActive(false); signals.isOpen.value = false; host.hidden = true; rerender(); } },
    toggle() { if (signals.isOpen.value) handle.hide(); else handle.show(); },
    refresh() { return disposed ? Promise.resolve() : refresh.refreshTree(); }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!event.ctrlKey || !event.shiftKey) {
      if (event.key === "Escape" && host.contains(document.activeElement) && !(event.target instanceof HTMLInputElement)) void refresh.select(null);
      return;
    }
    if (event.code === "KeyL") { event.preventDefault(); runtime.setLayout(signals.layout.value === "single" ? "split" : "single"); }
    if (event.code === "KeyY") { event.preventDefault(); runtime.setTheme(signals.theme.value === "dark" ? "light" : "dark"); }
    if (event.code === "KeyE") { event.preventDefault(); handle.toggle(); }
    if (event.code === "KeyF" && signals.isOpen.value) {
      event.preventDefault();
      host.querySelector<HTMLInputElement>(".ble-search input")?.focus();
    }
  };
  if (options.keyboardShortcutsEnabled !== false) {
    window.addEventListener("keydown", onKeyDown);
    disposables.add(createDisposable(() => window.removeEventListener("keydown", onKeyDown)));
  }
  return handle;
}
