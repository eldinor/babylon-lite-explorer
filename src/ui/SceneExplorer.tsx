import type { LiteEntity } from "../adapter/LiteSceneAdapter";
import { useInspectorRuntime } from "./runtime";

function TreeNode({ entity, level }: { entity: LiteEntity; level: number }) {
  const { signals, refresh } = useInspectorRuntime();
  const expanded = signals.expandedIds.value.has(entity.id);
  const selected = signals.selectedEntityId.value === entity.id;
  const hasChildren = !!entity.children?.length;
  const toggle = () => {
    const next = new Set(signals.expandedIds.value);
    if (expanded) next.delete(entity.id); else next.add(entity.id);
    signals.expandedIds.value = next;
  };
  return <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={selected}>
    <div class={`bli-tree-row${selected ? " is-selected" : ""}`} style={{ paddingLeft: `${level * 14 + 4}px` }}>
      <button class="bli-tree-toggle" type="button" aria-label={expanded ? "Collapse" : "Expand"} disabled={!hasChildren} onClick={toggle}>{hasChildren ? (expanded ? "▾" : "▸") : ""}</button>
      <button class="bli-tree-label" type="button" onClick={() => void refresh.select(entity.id)} onDblClick={toggle} onKeyDown={(event) => {
        if (event.key === "ArrowRight" && hasChildren && !expanded) { event.preventDefault(); toggle(); }
        if (event.key === "ArrowLeft" && hasChildren && expanded) { event.preventDefault(); toggle(); }
      }}>
        <span class={`bli-kind bli-kind-${entity.kind}`} aria-hidden="true" />{entity.label}
      </button>
    </div>
    {hasChildren && expanded && <ul role="group">{entity.children!.map((child) => <TreeNode key={child.id} entity={child} level={level + 1} />)}</ul>}
  </li>;
}

export function SceneExplorer() {
  const { signals } = useInspectorRuntime();
  const tree = signals.filteredTree.value;
  return <div class="bli-explorer">
    <label class="bli-search"><span class="bli-sr-only">Search scene</span><input value={signals.search.value} onInput={(event) => { signals.search.value = event.currentTarget.value; }} placeholder="Search scene…" /></label>
    {tree.length
      ? <ul class="bli-tree" role="tree" aria-label="Scene entities">{tree.map((entity) => <TreeNode key={entity.id} entity={entity} level={0} />)}</ul>
      : <div class="bli-empty">No entities are exposed by the supported public API. Use explicit registration for application-owned entities.</div>}
  </div>;
}
