import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface ActiveConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export const useConfirmStore = defineStore('confirm', () => {
  const active = ref<ActiveConfirm | null>(null);

  function ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      active.value = { ...options, resolve };
    });
  }

  function answer(value: boolean): void {
    if (active.value) {
      active.value.resolve(value);
      active.value = null;
    }
  }

  return { active, ask, answer };
});
