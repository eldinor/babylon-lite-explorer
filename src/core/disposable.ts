export type Disposable = { dispose(): void };

export function createDisposable(dispose: () => void): Disposable {
  let disposed = false;
  return { dispose: () => { if (!disposed) { disposed = true; dispose(); } } };
}

export class DisposableStore implements Disposable {
  private readonly values: Disposable[] = [];
  private disposed = false;

  add<T extends Disposable>(value: T): T {
    if (this.disposed) value.dispose();
    else this.values.push(value);
    return value;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const value of this.values.reverse()) value.dispose();
    this.values.length = 0;
  }
}
