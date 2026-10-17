import { reactive, watch } from "vue";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import type { Shipment } from "@shipment/services/shipment.types";

/**
 * Helper for "1 field → 1 commit on blur" bindings. Reads from the store,
 * exposes a reactive `local` value the v-model writes to, and pushes back
 * on commit().
 *
 * Returns a reactive proxy so the template can access `binding.local`
 * directly:
 *
 *   const awb = useFieldBinding('AWB_forn', '');
 *   // template:  <v-text-field v-model="awb.local" @blur="awb.commit" />
 *
 * Implementation note: returning a plain object with a `ref` property would
 * NOT auto-unwrap in templates (Vue 3 only unwraps top-level refs, not refs
 * accessed via dot notation). Wrapping in `reactive` solves it.
 */
export interface FieldBinding<T> {
  local: T;
  commit: () => Promise<void>;
}

export function useFieldBinding<K extends keyof Shipment>(
  field: K,
  fallback: NonNullable<Shipment[K]>,
): FieldBinding<NonNullable<Shipment[K]>> {
  const store = useShipmentStore();

  const binding = reactive({
    local: fallback,
    async commit(): Promise<void> {
      const current = store.shipment?.[field];
      if (binding.local === current) return;
      await store.update({ [field]: binding.local } as Partial<Shipment>);
    },
  }) as FieldBinding<NonNullable<Shipment[K]>>;

  watch(
    () => store.shipment?.[field],
    (v) => {
      binding.local = (v ?? fallback) as NonNullable<Shipment[K]>;
    },
    { immediate: true },
  );

  return binding;
}
