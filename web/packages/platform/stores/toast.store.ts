/**
 * Toast store — fuente ÚNICA para todas las SPAs (cargo/shipment/invoicing…).
 * Las apps lo consumen vía `@/stores/toast.store`, que re-exporta este módulo
 * (`export * from '@shared/stores/toast.store'`) para no tocar a sus ~40+
 * consumidores. Store Pinia agnóstico: no depende de lógica de ninguna app.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  timeout: number;
}

let counter = 0;

export const useToastStore = defineStore('toast', () => {
  const items = ref<Toast[]>([]);

  function push(kind: ToastKind, message: string, timeout = 4000): number {
    const id = ++counter;
    items.value.push({ id, kind, message, timeout });
    if (timeout > 0) {
      window.setTimeout(() => dismiss(id), timeout);
    }
    return id;
  }

  function dismiss(id: number): void {
    items.value = items.value.filter((t) => t.id !== id);
  }

  return { items, push, dismiss };
});

/**
 * Imperative helper for non-component code (services, http listeners).
 */
export function toast(kind: ToastKind, message: string, timeout = 4000): void {
  useToastStore().push(kind, message, timeout);
}
