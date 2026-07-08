import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import bpLogoUrl from "../assets/bplogo.svg";
import { ErrorBoundary } from "./ErrorBoundary";
import { useExplorerRuntime } from "./runtime";

export function Shell({ title }: { title: string }) {
  const { signals, shell, setLayout, setTheme, hide, dispose } = useExplorerRuntime();
  const panes = signals.panes.value;
  const toolbarItems = signals.toolbarItems.value;
  const toolbar = (location: "top-left" | "top-right" | "bottom-left" | "bottom-right") => toolbarItems
    .filter((item) => item.location === location)
    .map((item) => { const Item = item.component; return <Item key={item.key} />; });
  const renderSide = (side: "left" | "right") => {
    const choices = panes.filter((pane) => pane.side === side);
    const selectedKey = signals.selectedPanes.value[side];
    const selected = choices.find((pane) => pane.key === selectedKey) ?? choices[0];
    return <section class={`ble-pane ble-pane-${side}${side === "left" ? " ble-pane-has-footer" : ""}`}>
      <div class="ble-tabs" role="tablist" aria-label={`${side} panels`}>{choices.map((pane) => <button type="button" role="tab" aria-selected={pane.key === selected?.key} onClick={() => shell.selectPane(pane.key)} key={pane.key}>{pane.title}</button>)}{side === "left" && <PickingToggle />}</div>
      <div class="ble-pane-content">{choices.map((pane) => {
        const active = pane.key === selected?.key;
        if (!active && !pane.keepMounted) return null;
        const Content = pane.content;
        return <div role="tabpanel" hidden={!active} key={pane.key}><ErrorBoundary><Content /></ErrorBoundary></div>;
      })}</div>
      {side === "left" && <LinksFooter />}
    </section>;
  };
  const renderSingle = () => {
    const setPercent = (value: number) => {
      signals.singlePanePercent.value = value;
      try { localStorage.setItem("ble.singlePanePercent", String(value)); } catch { /* optional persistence */ }
    };
    const renderSingleSide = (side: "left" | "right") => {
      const choices = panes.filter((pane) => pane.side === side);
      const selectedKey = signals.selectedPanes.value[side];
      const selected = choices.find((pane) => pane.key === selectedKey) ?? choices[0];
      return <section class={`ble-pane ble-pane-single ble-pane-single-${side}${side === "left" ? " ble-pane-has-footer" : ""}`}>
        <div class="ble-tabs" role="tablist" aria-label={`${side} panels`}>{choices.map((pane) => <button type="button" role="tab" aria-selected={pane.key === selected?.key} onClick={() => shell.selectPane(pane.key)} key={pane.key}>{pane.title}</button>)}{side === "left" && <PickingToggle />}</div>
        <div class="ble-pane-content">{choices.map((pane) => {
          const active = pane.key === selected?.key;
          if (!active && !pane.keepMounted) return null;
          const Content = pane.content;
          return <div role="tabpanel" hidden={!active} key={pane.key}><ErrorBoundary><Content /></ErrorBoundary></div>;
        })}</div>
        {side === "left" && <LinksFooter />}
      </section>;
    };
    return <div class="ble-single-stack" style={{ gridTemplateRows: `${signals.singlePanePercent.value}% 5px minmax(0, 1fr)` }}>
      {renderSingleSide("left")}
      <ResizeHandle axis="vertical" onChange={setPercent} />
      {renderSingleSide("right")}
    </div>;
  };
  if (signals.layout.value === "split") {
    return <div class="ble-split-shell">
      <section class="ble-split-dock ble-split-dock-left">
        <header class="ble-toolbar"><strong>{title}</strong>{toolbar("top-left")}</header>
        {renderSide("left")}
      </section>
      <section class="ble-split-dock ble-split-dock-right">
        <header class="ble-toolbar">
          <div class="ble-toolbar-zone">{toolbar("top-right")}</div>
          <div class="ble-toolbar-actions">
            <button type="button" title="Switch to single layout" onClick={() => setLayout("single")}>Single</button>
            <button type="button" title={`Switch to ${signals.theme.value === "dark" ? "light" : "dark"} theme`} onClick={() => setTheme(signals.theme.value === "dark" ? "light" : "dark")}>{signals.theme.value === "dark" ? "Light" : "Dark"}</button>
            <button type="button" title="Hide Explorer (Ctrl+Shift+E)" onClick={hide}>Hide</button>
            <button class="ble-dispose" type="button" title="Dispose Explorer permanently" aria-label="Dispose explorer permanently" onClick={dispose}>×</button>
          </div>
        </header>
        {renderSide("right")}
        <SelectionBar />
        <StatusBar left={toolbar("bottom-left")} right={toolbar("bottom-right")} />
        <PropertiesFooter />
      </section>
      <Notifications />
    </div>;
  }
  return <div class="ble-shell">
    <header class="ble-toolbar">
      <div class="ble-toolbar-zone"><strong>{title}</strong>{toolbar("top-left")}</div>
      <div class="ble-toolbar-actions">
        {toolbar("top-right")}
        <button type="button" title={`Switch to ${signals.layout.value === "single" ? "split" : "single"} layout`} onClick={() => setLayout(signals.layout.value === "single" ? "split" : "single")}>{signals.layout.value === "single" ? "Split" : "Single"}</button>
        <button type="button" title={`Switch to ${signals.theme.value === "dark" ? "light" : "dark"} theme`} onClick={() => setTheme(signals.theme.value === "dark" ? "light" : "dark")}>{signals.theme.value === "dark" ? "Light" : "Dark"}</button>
        <button type="button" title="Hide Explorer (Ctrl+Shift+E)" onClick={hide}>Hide</button>
        <button class="ble-dispose" type="button" title="Dispose Explorer permanently" aria-label="Dispose explorer permanently" onClick={dispose}>×</button>
      </div>
    </header>
    <main class="ble-main ble-main-single">{renderSingle()}</main>
    <SelectionBar />
    <StatusBar left={toolbar("bottom-left")} right={toolbar("bottom-right")} />
    <PropertiesFooter />
    <Notifications />
  </div>;
}

function PickingToggle() {
  const { signals, setPickingActive } = useExplorerRuntime();
  if (!signals.pickingAvailable.value) return null;
  const active = signals.pickingActive.value;
  return <button
    class={`ble-pick-toggle${active ? " is-active" : ""}`}
    type="button"
    aria-pressed={active}
    title={active ? "Picking mode active" : "Picking mode inactive"}
    onClick={() => setPickingActive(!active)}
  >Pick: {active ? "On" : "Off"}</button>;
}

function ResizeHandle({ axis, onChange }: { axis: "horizontal" | "vertical"; onChange(value: number): void }) {
  const dragging = useRef(false);
  return <div
    class={`ble-resize-handle is-${axis}`}
    role="separator"
    aria-orientation={axis}
    tabIndex={0}
    onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={(event) => {
      if (!dragging.current) return;
      const parent = event.currentTarget.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const raw = axis === "vertical" ? ((event.clientY - rect.top) / rect.height) * 100 : ((event.clientX - rect.left) / rect.width) * 100;
      onChange(Math.round(Math.min(75, Math.max(25, raw))));
    }}
    onPointerUp={(event) => { dragging.current = false; event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancel={() => { dragging.current = false; }}
    onKeyDown={(event) => {
      const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -2 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 2 : 0;
      if (!delta) return;
      event.preventDefault();
      const current = axis === "vertical"
        ? Number((event.currentTarget.parentElement?.style.gridTemplateRows.match(/^([\d.]+)%/) ?? [])[1])
        : Number((event.currentTarget.parentElement?.style.gridTemplateColumns.match(/^([\d.]+)%/) ?? [])[1]);
      onChange(Math.min(75, Math.max(25, (Number.isFinite(current) ? current : 40) + delta)));
    }}
  />;
}

function SelectionBar() {
  const { signals, commands, notifications } = useExplorerRuntime();
  const selected = signals.selectedEntity.value;
  const context = signals.context.value;
  const actionLabels: Record<string, string> = {
    "copy-entity-snapshot": "Copy",
    "toggle-visible": "Visible",
    "focus-selected": "Focus",
    "play-animation": "PLAY",
    "stop-animation": "STOP"
  };
  const actions = selected ? commands.list(selected).filter((command) => command.id in actionLabels) : [];
  const run = async (id: string) => {
    const command = commands.get(id);
    if (!command || !context) return;
    try { await command.run(selected, context); }
    catch (error) { notifications.push(error instanceof Error ? error.message : `Command failed: ${command.label}`); }
  };
  return selected
    ? <div class="ble-selection-status"><span>Selected</span><strong>{selected.label}</strong><div class="ble-selection-actions">{actions.map((action) => <button type="button" key={action.id} onClick={() => void run(action.id)}>{actionLabels[action.id]}</button>)}</div></div>
    : <div class="ble-selection-status is-empty" aria-hidden="true" />;
}

function StatusBar({ left, right }: { left: ComponentChildren; right: ComponentChildren }) {
  const { signals } = useExplorerRuntime();
  const stats = signals.stats.value;
  const items = [
    stats.fps !== undefined && `FPS ${stats.fps.toFixed(0)}`,
    stats.frameMs !== undefined && `Frame int. ${stats.frameMs.toFixed(1)} ms`,
    stats.drawCallCount !== undefined && `Draws ${stats.drawCallCount}`,
    stats.gpuFrameTimeMs !== undefined && `GPU ${stats.gpuFrameTimeMs.toFixed(1)} ms`,
    stats.meshCount !== undefined && `Meshes ${stats.meshCount}`,
    stats.lightCount !== undefined && `Lights ${stats.lightCount}`
  ].filter(Boolean);
  return <footer class="ble-status">
    <span class="ble-status-zone">{left}{items.length ? items.map((item) => <span key={String(item)}>{item}</span>) : <span>Ready</span>}</span>
    <span class="ble-status-zone">{right}</span>
  </footer>;
}

function LinksFooter() {
  const { userGuideUrl } = useExplorerRuntime();
  return <footer class="ble-links-footer">
    <a class="ble-footer-help" href={userGuideUrl} target="_blank" rel="noreferrer" title="Open User Guide" aria-label="Open User Guide">?</a>
    <a class="ble-footer-logo" href="https://babylonpress.org/" target="_blank" rel="noreferrer" title="Created by BabylonPress"><img src={bpLogoUrl} alt="BabylonPress" /></a>
    <a class="ble-footer-github" href="https://github.com/eldinor/babylon-lite-explorer" target="_blank" rel="noreferrer" title="Babylon Lite Explorer on GitHub" aria-label="Babylon Lite Explorer on GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.28-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.19-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg></a>
  </footer>;
}

function PropertiesFooter() {
  const { signals, shell, refresh } = useExplorerRuntime();
  const count = signals.stats.value.animationGroupCount;
  const openAnimationGroups = async () => {
    const scene = signals.tree.value[0];
    const animations = scene?.children?.find((entity) => entity.label === "Animation Groups");
    if (!scene || !animations) return;
    shell.selectPane("scene-explorer");
    signals.search.value = "";
    signals.expandedIds.value = new Set([...signals.expandedIds.value, scene.id, animations.id]);
    await refresh.select(animations.id);
  };
  return <footer class="ble-properties-footer" aria-label="Properties footer">
    {count !== undefined && count > 0 && <button type="button" onClick={() => void openAnimationGroups()}>Animation Groups {count}</button>}
  </footer>;
}

function Notifications() {
  const { signals, notifications } = useExplorerRuntime();
  return <div class="ble-notifications" aria-live="polite">{signals.notifications.value.map((item) => <div class={`ble-notification is-${item.tone}`} key={item.id}>{item.message}<button type="button" aria-label="Dismiss notification" onClick={() => notifications.dismiss(item.id)}>×</button></div>)}</div>;
}
