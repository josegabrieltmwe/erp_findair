import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from "vue";

/** Tiempo mínimo fuera de la pestaña para que valga la pena releer (el legado: 15 s). */
export const REVISIT_MIN_MS = 15_000;

/**
 * ¿Hay que releer el listado al volver a la pestaña? Pura, para probarla.
 * No se relee si la lista cambiaría bajo las manos del operador (ficha o diálogo abierto, filas
 * seleccionadas, una carga en curso) ni si estuvo fuera menos de `minMs`.
 */
export function shouldRefreshOnReturn(o: {
  hiddenForMs: number;
  minMs?: number;
  busy: boolean;
}): boolean {
  return !o.busy && o.hiddenForMs >= (o.minMs ?? REVISIT_MIN_MS);
}

/**
 * Relee el listado cuando el operador vuelve a la pestaña tras un rato. Sin polling: una relectura al
 * volver, que es cuando la cola puede haber cambiado (otro operador, el proceso de fondo). Vive bajo
 * <KeepAlive>: el listener se quita al desactivar y se pone al activar.
 */
export function useVisibilityRefresh(opts: {
  refresh: () => void | Promise<void>;
  /** true si no se debe tocar la lista ahora. */
  isBusy: () => boolean;
  minMs?: number;
}): void {
  let hiddenAt: number | null = null;
  let attached = false;

  function onChange(): void {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt === null) return;
    const hiddenForMs = Date.now() - hiddenAt;
    hiddenAt = null;
    if (
      shouldRefreshOnReturn({
        hiddenForMs,
        minMs: opts.minMs,
        busy: opts.isBusy(),
      })
    ) {
      void opts.refresh();
    }
  }

  function attach(): void {
    if (attached) return;
    attached = true;
    document.addEventListener("visibilitychange", onChange);
  }
  function detach(): void {
    if (!attached) return;
    attached = false;
    hiddenAt = null;
    document.removeEventListener("visibilitychange", onChange);
  }

  onMounted(attach);
  onActivated(attach);
  onDeactivated(detach);
  onBeforeUnmount(detach);
}
