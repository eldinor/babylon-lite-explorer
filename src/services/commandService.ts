import type { LiteInspectorContext } from "../api/types";
import type { LiteEntity } from "../adapter/LiteSceneAdapter";
import type { Disposable } from "../core/disposable";
import { createDisposable } from "../core/disposable";

export type InspectorCommand = {
  id: string;
  label: string;
  when?: (entity: LiteEntity | null) => boolean;
  run: (entity: LiteEntity | null, context: LiteInspectorContext) => void | Promise<void>;
};

export class CommandService {
  readonly id = "commands";
  private readonly commands = new Map<string, InspectorCommand>();
  register(command: InspectorCommand): Disposable {
    if (this.commands.has(command.id)) throw new Error(`Command already registered: ${command.id}`);
    this.commands.set(command.id, command);
    return createDisposable(() => this.commands.delete(command.id));
  }
  get(id: string): InspectorCommand | undefined { return this.commands.get(id); }
  list(entity: LiteEntity | null): InspectorCommand[] { return [...this.commands.values()].filter((item) => item.when?.(entity) ?? true); }
  dispose(): void { this.commands.clear(); }
}
