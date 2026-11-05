import { ref, type Ref } from 'vue';

/**
 * Recuento de los KPI de un listado (los tiles que no son el tipo activo).
 *
 * Cada tile es una petición `count_only=1` (sin filas) sobre el MISMO filtro
 * que el listado. Este contador:
 *
 *  - deduplica por clave de filtro: si ya se pidió (o se está pidiendo) para
 *    esa clave, no repite — el watcher del filtro y la entrada al listado
 *    llegaban a pedir lo mismo dos veces;
 *  - cancela la tanda anterior con su propio AbortController (NO el del
 *    listado: compartirlo cancelaría la página que el operador está viendo);
 *  - un KPI que falla vuelve a "—" (se borra su cifra) y la clave se olvida,
 *    para que la siguiente entrada lo reintente.
 */
export interface KpiCounter {
  counts: Ref<Record<string, number>>;
  /** Pide los recuentos para `filterKey`; no hace nada si ya se pidieron. */
  refresh: (filterKey: string) => Promise<void>;
  /** Cancela la tanda en curso (salida del listado). */
  abort: () => void;
  /** Olvida la última clave: la siguiente `refresh` pide aunque coincida. */
  invalidate: () => void;
}

export function createKpiCounter(opts: {
  keys: readonly string[];
  /** Devuelve el total del KPI `key`. Debe respetar `signal`. */
  fetchTotal: (key: string, signal: AbortSignal) => Promise<number>;
}): KpiCounter {
  const counts = ref<Record<string, number>>({});
  let controller: AbortController | null = null;
  let lastKey: string | null = null;

  async function refresh(filterKey: string): Promise<void> {
    if (filterKey === lastKey) return;
    if (controller) controller.abort();
    const ctrl = new AbortController();
    controller = ctrl;
    lastKey = filterKey;
    let failed = false;
    await Promise.all(
      opts.keys.map(async (key) => {
        try {
          const n = await opts.fetchTotal(key, ctrl.signal);
          if (!ctrl.signal.aborted) counts.value[key] = n;
        } catch {
          if (ctrl.signal.aborted) return;
          failed = true;
          delete counts.value[key];
        }
      }),
    );
    if (controller === ctrl) {
      controller = null;
      if (failed) lastKey = null;
    }
  }

  function abort(): void {
    if (controller) {
      controller.abort();
      controller = null;
      // La tanda no terminó: la próxima entrada debe volver a pedirla.
      lastKey = null;
    }
  }

  function invalidate(): void {
    lastKey = null;
  }

  return { counts, refresh, abort, invalidate };
}
