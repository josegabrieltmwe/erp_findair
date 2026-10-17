import { useCargoStore } from "@cargo/stores/cargo.store";
import type { Cargo } from "@cargo/services/cargo.types";
import {
  useMoneyFieldBinding as useMoneyFieldBindingShared,
  type MoneyFieldBinding,
} from "@tmwe/shared-frontend/composables/useMoneyFieldBinding";

/**
 * Cargo wrapper around the shared money-field binding. Keeps the original
 * `(field, toDisplay, siglaRef)` signature so existing call-sites don't change;
 * injects the cargo store's direct persist.
 */
export function useMoneyFieldBinding(
  field: keyof Cargo,
  toDisplay: (eur: number | string | null | undefined) => number,
  siglaRef: () => string,
): MoneyFieldBinding {
  const store = useCargoStore();
  return useMoneyFieldBindingShared({
    field: field as string,
    toDisplay,
    siglaRef,
    getStoredValue: () =>
      store.cargo?.[field] as number | string | null | undefined,
    persist: (patch) => store.persistUpdate(patch as Partial<Cargo>),
  });
}

export type { MoneyFieldBinding };
