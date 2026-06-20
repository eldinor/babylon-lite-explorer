import { computed, signal } from "@preact/signals";
import type { LiteInspectorContext, LiteInspectorLayout, LiteInspectorTheme } from "../api/types";
import type { LiteEntity, LiteSceneAdapter, LiteStats } from "../adapter/LiteSceneAdapter";
import type { PropertyDescriptor } from "../adapter/propertyDescriptors";
import type { SidePaneDefinition, ToolbarItemDefinition } from "../services/shellService";
import { filterTree, findEntityById } from "./treeUtils";

export type InspectorNotification = { id: number; tone: "error" | "info"; message: string };

export function createInspectorSignals() {
  const isOpen = signal(true);
  const theme = signal<LiteInspectorTheme>("dark");
  const layout = signal<LiteInspectorLayout>("single");
  const context = signal<LiteInspectorContext | null>(null);
  const adapter = signal<LiteSceneAdapter | null>(null);
  const sceneVersion = signal(0);
  const selectedEntityId = signal<string | null>(null);
  const tree = signal<LiteEntity[]>([]);
  const properties = signal<PropertyDescriptor[]>([]);
  const stats = signal<LiteStats>({});
  const search = signal("");
  const expandedIds = signal<ReadonlySet<string>>(new Set());
  const notifications = signal<InspectorNotification[]>([]);
  const isRefreshingTree = signal(false);
  const isRefreshingProperties = signal(false);
  const panes = signal<SidePaneDefinition[]>([]);
  const toolbarItems = signal<ToolbarItemDefinition[]>([]);
  const selectedPanes = signal<Record<"left" | "right" | "single", string | null>>({ left: null, right: null, single: null });
  const singlePanePercent = signal(44);
  const selectedEntity = computed(() => selectedEntityId.value ? findEntityById(tree.value, selectedEntityId.value) : null);
  const filteredTree = computed(() => filterTree(tree.value, search.value));

  return {
    isOpen, theme, layout, context, adapter, sceneVersion, selectedEntityId, selectedEntity,
    tree, filteredTree, properties, stats, search, expandedIds, notifications,
    isRefreshingTree, isRefreshingProperties, panes, toolbarItems, selectedPanes,
    singlePanePercent
  };
}

export type InspectorSignals = ReturnType<typeof createInspectorSignals>;
