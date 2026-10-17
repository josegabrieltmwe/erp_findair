import { useShipmentStore } from "@shipment/stores/shipment.store";
import type { Shipment } from "@shipment/services/shipment.types";
import {
  useMoneyFieldBinding as useMoneyFieldBindingShared,
  type MoneyFieldBinding,
} from "@tmwe/shared-frontend/composables/useMoneyFieldBinding";

/**
 * Express wrapper around the shared money-field binding. Injects the shipment
 * store's direct persist.
 */
export function useMoneyFieldBinding(
  field: keyof Shipment,
  toDisplay: (eur: number | string | null | undefined) => number,
  siglaRef: () => string,
): MoneyFieldBinding {
  const store = useShipmentStore();
  return useMoneyFieldBindingShared({
    field: field as string,
    toDisplay,
    siglaRef,
    getStoredValue: () =>
      store.shipment?.[field] as number | string | null | undefined,
    persist: (patch) => store.persistUpdate(patch as Partial<Shipment>),
  });
}

export type { MoneyFieldBinding };
