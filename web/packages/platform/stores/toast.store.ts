/**
 * Toast store — fuente ÚNICA para todas las SPAs (cargo/shipment/invoicing…).
 * Las apps lo consumen vía `@/stores/toast.store` y `@shared/anagrafiche/stores/toast.store`, que re-exportan este
 * módulo. Store Pinia agnóstico: no depende de lógica de ninguna app.
 *
 * Antes había DOS stores con el mismo id `toast` (este, con `items` + `push`, y el de anagrafiche, con `toasts` +
 * `error()/success()`). Pinia devuelve la instancia que se creó primero, así que según el orden de carga
 * `toast.error(...)` no existía o `AppToaster` leía una lista que nadie llenaba: el aviso se perdía sin error. Ahora
 * hay una sola, con las dos formas de llamarla.
 *
 * Reglas:
 *  - Un error no se cierra solo (timeout 0): el operador tiene que verlo. El resto, 4 s.
 *  - El mismo aviso (tipo + texto) no se apila mientras sigue visible.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** ms; 0 = hasta que el usuario lo cierra. */
  timeout: number;
}

const DEFAULT_TIMEOUT = 4000;

let counter = 0;

function defaultTimeout(kind: ToastKind): number {
  return kind === 'error' ? 0 : DEFAULT_TIMEOUT;
}

export const useToastStore = defineStore('toast', () => {
  const items = ref<Toast[]>([]);

  function push(kind: ToastKind, message: string, timeout?: number): number {
    const text = String(message ?? '').trim();
    const existing = items.value.find((t) => t.kind === kind && t.message === text);
    if (existing) return existing.id;
    const id = ++counter;
    const ms = timeout ?? defaultTimeout(kind);
    items.value.push({ id, kind, message: text, timeout: ms });
    if (ms > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => dismiss(id), ms);
    }
    return id;
  }

  function dismiss(id: number): void {
    items.value = items.value.filter((t) => t.id !== id);
  }

  return {
    items,
    /** Alias de `items` (forma del antiguo store de anagrafiche, la que lee AppToaster). */
    toasts: items,
    push,
    dismiss,
    info: (m: string, t?: number) => push('info', m, t),
    success: (m: string, t?: number) => push('success', m, t),
    warning: (m: string, t?: number) => push('warning', m, t),
    error: (m: string, t?: number) => push('error', m, t),
  };
});

/**
 * Imperative helper for non-component code (services, http listeners).
 */
export function toast(kind: ToastKind, message: string, timeout?: number): void {
  useToastStore().push(kind, message, timeout);
}
