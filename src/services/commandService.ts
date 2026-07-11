import type { LiteExplorerContext } from "../api/types";
import type { LiteEntity } from "../adapter/LiteSceneAdapter";
import type { Disposable } from "../core/disposable";
import { createDisposable } from "../core/disposable";
import type { LiteExplorerCommand } from "../api/extensions";

export type ExplorerCommand = Omit<LiteExplorerCommand, "run"> & {
  run: (entity: LiteEntity | null, context: LiteExplorerContext) => void | Promise<void>;
};

export class CommandService {
  readonly id = "commands";
  private readonly commands = new Map<string, ExplorerCommand>();
  register(command: ExplorerCommand): Disposable {
    if (this.commands.has(command.id)) throw new Error(`Command already registered: ${command.id}`);
    this.commands.set(command.id, command);
    return createDisposable(() => this.commands.delete(command.id));
  }
  get(id: string): ExplorerCommand | undefined { return this.commands.get(id); }
  list(entity: LiteEntity | null): ExplorerCommand[] { return [...this.commands.values()].filter((item) => item.when?.(entity) ?? true); }
  dispose(): void { this.commands.clear(); }
}
