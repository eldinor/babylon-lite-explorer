import type { ComponentType } from "preact";
import type { Disposable } from "../core/disposable";
import { createDisposable } from "../core/disposable";
import type { ExplorerSignals } from "../signals/createExplorerSignals";

export type SidePaneDefinition = {
  key: string;
  title: string;
  side: "left" | "right";
  order?: number;
  icon?: ComponentType;
  content: ComponentType;
  keepMounted?: boolean;
};

export type ToolbarItemDefinition = {
  key: string;
  title?: string;
  location: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  order?: number;
  component: ComponentType;
};

const sort = <T extends { order?: number; key: string }>(values: T[]) => [...values].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.key.localeCompare(b.key));

export class ShellService {
  constructor(private readonly signals: ExplorerSignals) {}

  addSidePane(pane: SidePaneDefinition): Disposable {
    if (this.signals.panes.value.some((item) => item.key === pane.key)) throw new Error(`Pane already registered: ${pane.key}`);
    this.signals.panes.value = sort([...this.signals.panes.value, pane]);
    if (!this.signals.selectedPanes.value[pane.side]) this.selectPane(pane.key, false);
    if (!this.signals.selectedPanes.value.single) this.signals.selectedPanes.value = { ...this.signals.selectedPanes.value, single: pane.key };
    return createDisposable(() => {
      this.signals.panes.value = this.signals.panes.value.filter((item) => item.key !== pane.key);
      if (this.signals.selectedPanes.value[pane.side] === pane.key) {
        const replacement = this.signals.panes.value.find((item) => item.side === pane.side)?.key ?? null;
        this.signals.selectedPanes.value = { ...this.signals.selectedPanes.value, [pane.side]: replacement };
      }
    });
  }

  addToolbarItem(item: ToolbarItemDefinition): Disposable {
    if (this.signals.toolbarItems.value.some((value) => value.key === item.key)) throw new Error(`Toolbar item already registered: ${item.key}`);
    this.signals.toolbarItems.value = sort([...this.signals.toolbarItems.value, item]);
    return createDisposable(() => { this.signals.toolbarItems.value = this.signals.toolbarItems.value.filter((value) => value.key !== item.key); });
  }

  selectPane(key: string, selectSingle = true): void {
    const pane = this.signals.panes.value.find((item) => item.key === key);
    if (!pane) return;
    this.signals.selectedPanes.value = {
      ...this.signals.selectedPanes.value,
      [pane.side]: key,
      ...(selectSingle ? { single: key } : {})
    };
  }
}
