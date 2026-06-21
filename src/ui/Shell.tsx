import type { ComponentChildren } from "preact";
import { Fragment } from "preact";
import { useRef } from "preact/hooks";
import { ErrorBoundary } from "./ErrorBoundary";
import { useExplorerRuntime } from "./runtime";

export function Shell({ title }: { title: string }) {
  const { signals, shell, setLayout, setTheme, close } = useExplorerRuntime();
  const panes = signals.panes.value;
  const toolbarItems = signals.toolbarItems.value;
  const toolbar = (location: "top-left" | "top-right" | "bottom-left" | "bottom-right") => toolbarItems
    .filter((item) => item.location === location)
    .map((item) => { const Item = item.component; return <Item key={item.key} />; });
  const renderSide = (side: "left" | "right") => {
    const choices = panes.filter((pane) => pane.side === side);
    const selectedKey = signals.selectedPanes.value[side];
    const selected = choices.find((pane) => pane.key === selectedKey) ?? choices[0];
    return <section class={`ble-pane ble-pane-${side}`}>
      <div class="ble-tabs" role="tablist" aria-label={`${side} panels`}>{choices.map((pane) => <button type="button" role="tab" aria-selected={pane.key === selected?.key} onClick={() => shell.selectPane(pane.key)} key={pane.key}>{pane.title}</button>)}{side === "left" && <PickingToggle />}</div>
      <div class="ble-pane-content">{choices.map((pane) => {
        const active = pane.key === selected?.key;
        if (!active && !pane.keepMounted) return null;
        const Content = pane.content;
        return <div role="tabpanel" hidden={!active} key={pane.key}><ErrorBoundary><Content /></ErrorBoundary></div>;
      })}</div>
    </section>;
  };
  const renderSingle = () => {
    const stackedPanes = [...panes].sort((a, b) => {
      const sideOrder = (a.side === "left" ? 0 : 1) - (b.side === "left" ? 0 : 1);
      return sideOrder || (a.order ?? 0) - (b.order ?? 0) || a.key.localeCompare(b.key);
    });
    const setPercent = (value: number) => {
      signals.singlePanePercent.value = value;
      try { localStorage.setItem("ble.singlePanePercent", String(value)); } catch { /* optional persistence */ }
    };
    return <div class="ble-single-stack" style={{ gridTemplateRows: `${signals.singlePanePercent.value}% 5px minmax(0, 1fr)` }}>{stackedPanes.map((pane, index) => {
        const Content = pane.content;
        return <Fragment key={pane.key}>{index === 1 && <ResizeHandle axis="vertical" onChange={setPercent} />}
        <section class={`ble-pane ble-pane-single ble-pane-single-${pane.side}`}>
          <div class="ble-pane-heading"><span>{pane.title}</span>{pane.side === "left" && <PickingToggle />}</div>
          <div class="ble-pane-content"><ErrorBoundary><Content /></ErrorBoundary></div>
        </section></Fragment>;
      })}</div>;
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
            <button type="button" onClick={() => setLayout("single")}>Single</button>
            <button type="button" onClick={() => setTheme(signals.theme.value === "dark" ? "light" : "dark")}>{signals.theme.value === "dark" ? "Light" : "Dark"}</button>
            <button type="button" aria-label="Dispose explorer" onClick={close}>×</button>
          </div>
        </header>
        {renderSide("right")}
        <SelectionBar />
        <StatusBar left={toolbar("bottom-left")} right={toolbar("bottom-right")} />
      </section>
      <Notifications />
    </div>;
  }
  return <div class="ble-shell">
    <header class="ble-toolbar">
      <div class="ble-toolbar-zone"><strong>{title}</strong>{toolbar("top-left")}</div>
      <div class="ble-toolbar-actions">
        {toolbar("top-right")}
        <button type="button" onClick={() => setLayout(signals.layout.value === "single" ? "split" : "single")}>{signals.layout.value === "single" ? "Split" : "Single"}</button>
        <button type="button" onClick={() => setTheme(signals.theme.value === "dark" ? "light" : "dark")}>{signals.theme.value === "dark" ? "Light" : "Dark"}</button>
        <button type="button" aria-label="Dispose explorer" onClick={close}>×</button>
      </div>
    </header>
    <main class="ble-main ble-main-single">{renderSingle()}</main>
    <SelectionBar />
    <StatusBar left={toolbar("bottom-left")} right={toolbar("bottom-right")} />
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
    "focus-selected": "Focus"
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
    stats.frameMs !== undefined && `Frame ${stats.frameMs.toFixed(1)} ms`,
    stats.drawCallCount !== undefined && `Draws ${stats.drawCallCount}`,
    stats.gpuFrameTimeMs !== undefined && `GPU ${stats.gpuFrameTimeMs.toFixed(1)} ms`,
    stats.meshCount !== undefined && `Meshes ${stats.meshCount}`,
    stats.lightCount !== undefined && `Lights ${stats.lightCount}`
  ].filter(Boolean);
  return <footer class="ble-status"><span class="ble-status-zone">{left}{items.length ? items.map((item) => <span key={String(item)}>{item}</span>) : <span>Ready</span>}</span><span class="ble-status-zone">{right}</span></footer>;
}

function Notifications() {
  const { signals, notifications } = useExplorerRuntime();
  return <div class="ble-notifications" aria-live="polite">{signals.notifications.value.map((item) => <div class={`ble-notification is-${item.tone}`} key={item.id}>{item.message}<button type="button" aria-label="Dismiss notification" onClick={() => notifications.dismiss(item.id)}>×</button></div>)}</div>;
}
