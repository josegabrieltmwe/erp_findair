import { onBeforeUnmount, watch } from "vue";
import { useConsolidataStore } from "../stores/consolidata.store";

/**
 * Un diálogo que pinta `store.error` dentro de sí lo declara con esto: mientras
 * está abierto, la página no muestra el mismo error otra vez detrás (E5).
 */
export function useDialogErrorScope(isOpen: () => boolean): void {
  const store = useConsolidataStore();
  let counted = false;
  const set = (open: boolean): void => {
    if (open && !counted) {
      store.openDialogs += 1;
      counted = true;
    } else if (!open && counted) {
      store.openDialogs = Math.max(0, store.openDialogs - 1);
      counted = false;
    }
  };
  watch(isOpen, (v) => set(Boolean(v)), { immediate: true });
  onBeforeUnmount(() => set(false));
}
