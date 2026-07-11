import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { LiteEntity } from "../adapter/LiteSceneAdapter";
import { useExplorerRuntime } from "./runtime";

const ROW_HEIGHT = 25;
const OVERSCAN = 8;

type FlatTreeRow = {
  entity: LiteEntity;
  level: number;
  parentId: string | null;
  position: number;
  setSize: number;
};

function isPlayingAnimation(entity: LiteEntity): boolean {
  if (entity.kind !== "animationGroup" || !entity.source || typeof entity.source !== "object") return false;
  return "isPlaying" in entity.source && (entity.source as { isPlaying?: unknown }).isPlaying === true;
}

function flattenVisibleTree(tree: readonly LiteEntity[], expanded: ReadonlySet<string>, expandAll: boolean): FlatTreeRow[] {
  const rows: FlatTreeRow[] = [];
  const visit = (entities: readonly LiteEntity[], level: number, parentId: string | null) => {
    entities.forEach((entity, index) => {
      rows.push({ entity, level, parentId, position: index + 1, setSize: entities.length });
      if (entity.children?.length && (expandAll || expanded.has(entity.id))) visit(entity.children, level + 1, entity.id);
    });
  };
  visit(tree, 0, null);
  return rows;
}

export function SceneExplorer() {
  const { signals, refresh, commands, notifications } = useExplorerRuntime();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const expandAll = signals.search.value.trim().length > 0;
  const rows = useMemo(
    () => flattenVisibleTree(signals.filteredTree.value, signals.expandedIds.value, expandAll),
    [signals.filteredTree.value, signals.expandedIds.value, expandAll]
  );

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () => setViewportHeight(element.clientHeight || 400);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const visibleStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleEnd = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  useEffect(() => {
    const selectedId = signals.selectedEntityId.value;
    const element = scroller.current;
    if (!selectedId || !element) return;
    const index = rows.findIndex((row) => row.entity.id === selectedId);
    if (index < 0) return;
    const top = index * ROW_HEIGHT;
    if (top < element.scrollTop || top + ROW_HEIGHT > element.scrollTop + viewportHeight) {
      element.scrollTop = Math.max(0, top - Math.floor(viewportHeight / 2));
      setScrollTop(element.scrollTop);
    }
  }, [rows, signals.selectedEntityId.value, viewportHeight]);
  const toggle = (id: string) => {
    const next = new Set(signals.expandedIds.value);
    if (next.has(id)) next.delete(id); else next.add(id);
    signals.expandedIds.value = next;
  };
  const focusRow = (index: number) => {
    const bounded = Math.max(0, Math.min(rows.length - 1, index));
    const element = scroller.current;
    if (!element || bounded < 0) return;
    const top = bounded * ROW_HEIGHT;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + ROW_HEIGHT > element.scrollTop + viewportHeight) element.scrollTop = top - viewportHeight + ROW_HEIGHT;
    requestAnimationFrame(() => element.querySelector<HTMLButtonElement>(`[data-tree-index="${bounded}"]`)?.focus());
  };
  const removeEntity = async (entity: LiteEntity) => {
    const context = signals.context.value;
    const command = commands.get("remove-entity");
    if (!context || !command) return;
    try { await command.run(entity, context); }
    catch (error) { notifications.push(error instanceof Error ? error.message : "Delete failed."); }
  };

  return <div class="ble-explorer">
    <label class="ble-search"><span class="ble-sr-only">Search scene</span><input value={signals.search.value} onInput={(event) => { signals.search.value = event.currentTarget.value; setScrollTop(0); if (scroller.current) scroller.current.scrollTop = 0; }} placeholder="Search scene…" /></label>
    {rows.length ? <div class="ble-tree-scroll" role="tree" aria-label="Scene entities" ref={scroller} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <div class="ble-tree-virtual" style={{ height: `${rows.length * ROW_HEIGHT}px` }}>
        {rows.slice(visibleStart, visibleEnd).map((row, offset) => {
          const index = visibleStart + offset;
          const { entity } = row;
          const expanded = expandAll || signals.expandedIds.value.has(entity.id);
          const selected = signals.selectedEntityId.value === entity.id;
          const hasChildren = !!entity.children?.length;
          const playing = isPlayingAnimation(entity);
          return <div
            class={`ble-tree-row${selected ? " is-selected" : ""}`}
            role="treeitem"
            aria-level={row.level + 1}
            aria-posinset={row.position}
            aria-setsize={row.setSize}
            aria-expanded={hasChildren ? expanded : undefined}
            aria-selected={selected}
            key={entity.id}
            style={{ top: `${index * ROW_HEIGHT}px`, paddingLeft: `${row.level * 14 + 4}px` }}
          >
            <button class="ble-tree-toggle" type="button" aria-label={expanded ? "Collapse" : "Expand"} disabled={!hasChildren || expandAll} onClick={() => toggle(entity.id)}>{hasChildren ? (expanded ? "▾" : "▸") : ""}</button>
            <button
              class="ble-tree-label"
              data-tree-index={index}
              type="button"
              onClick={() => void refresh.select(entity.id)}
              onDblClick={() => { if (!expandAll && hasChildren) toggle(entity.id); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); focusRow(index + 1); }
                if (event.key === "ArrowUp") { event.preventDefault(); focusRow(index - 1); }
                if (event.key === "ArrowRight" && hasChildren && !expanded && !expandAll) { event.preventDefault(); toggle(entity.id); }
                if (event.key === "ArrowLeft") {
                  if (hasChildren && expanded && !expandAll) { event.preventDefault(); toggle(entity.id); }
                  else if (row.parentId) { event.preventDefault(); focusRow(rows.findIndex((candidate) => candidate.entity.id === row.parentId)); }
                }
              }}
            ><span class={`ble-kind ble-kind-${entity.kind}${playing ? " is-playing" : ""}`} aria-hidden="true" />{entity.label}</button>
            {entity.capabilities.removable && <button
              class="ble-tree-delete"
              type="button"
              title={`Delete ${entity.label}`}
              aria-label={`Delete ${entity.label}`}
              onClick={() => void removeEntity(entity)}
            >x</button>}
          </div>;
        })}
      </div>
    </div> : <div class="ble-empty">No entities are exposed by the supported public API. Use explicit registration for application-owned entities.</div>}
  </div>;
}
