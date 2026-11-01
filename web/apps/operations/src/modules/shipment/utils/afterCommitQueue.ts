/**
 * Acciones que deben ejecutarse solo cuando el borrador se confirme con éxito
 * (p. ej. el aviso de entrega, que el servidor construye con los datos
 * guardados). Se identifican por clave para que repetir el mismo pendiente no
 * lo duplique; `clear` las descarta (cancelar el borrador).
 */
export function createAfterCommitQueue() {
  const pending = new Map<string, () => void | Promise<void>>();
  return {
    defer(key: string, fn: () => void | Promise<void>): void {
      pending.set(key, fn);
    },
    clear(): void {
      pending.clear();
    },
    get size(): number {
      return pending.size;
    },
    /** Vacía la cola y devuelve las acciones para ejecutarlas tras el commit. */
    take(): Array<() => void | Promise<void>> {
      const fns = [...pending.values()];
      pending.clear();
      return fns;
    },
  };
}
