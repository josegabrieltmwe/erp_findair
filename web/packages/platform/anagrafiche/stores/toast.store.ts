import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  timeout?: number;
}

let nextId = 1;

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);

  function push(kind: ToastKind, message: string, timeout = 4500): number {
    const id = nextId++;
    toasts.value.push({ id, kind, message, timeout });
    if (timeout > 0) {
      setTimeout(() => dismiss(id), timeout);
    }
    return id;
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    push,
    dismiss,
    info: (m: string, t?: number) => push('info', m, t),
    success: (m: string, t?: number) => push('success', m, t),
    warning: (m: string, t?: number) => push('warning', m, t),
    error: (m: string, t?: number) => push('error', m, t),
  };
});
