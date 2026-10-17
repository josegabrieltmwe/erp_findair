import { reactive, watch } from 'vue';

/**
 * "1 money field → 1 commit on blur" binding with target-currency display —
 * shared by cargo and shipment.
 *
 * The `local` value is shown in the client's target currency; on commit it is
 * sent together with `amount_currency` so the backend converts target → EUR
 * with the shipment-date rates (the single source of truth the legacy FldUpdSpc
 * used). When the target is EUR the conversion is a no-op end to end.
 *
 * Store-agnostic: the app injects how to read the stored EUR value and how to
 * persist (the store's direct persist, NOT the draft buffer — buffering a
 * target value would double-convert in sibling boxes).
 */
export interface MoneyFieldBinding {
  local: number;
  commit: () => Promise<void>;
}

export interface MoneyFieldBindingDeps {
  /** Reactive getter for the stored EUR value of this field. */
  getStoredValue: () => number | string | null | undefined;
  /** Active target sigla getter. */
  siglaRef: () => string;
  /** EUR → target display (from useTargetCurrency). */
  toDisplay: (eur: number | string | null | undefined) => number;
  /** Direct persist of `{ [field]: display, amount_currency: sigla }`. */
  persist: (patch: Record<string, unknown>) => Promise<unknown>;
  /** The backend column name for this money field. */
  field: string;
}

export function useMoneyFieldBinding(deps: MoneyFieldBindingDeps): MoneyFieldBinding {
  const binding = reactive({
    local: 0,
    async commit(): Promise<void> {
      const storedEur = Number(deps.getStoredValue() ?? 0);
      const displayedStored = deps.toDisplay(storedEur);
      // Nothing changed (compare in display space to avoid rounding churn).
      if (Number(binding.local) === displayedStored) return;

      const sigla = (deps.siglaRef() || 'EUR').toUpperCase();
      await deps.persist({
        [deps.field]: binding.local,
        amount_currency: sigla,
      });
    },
  }) as MoneyFieldBinding;

  // Keep `local` in display space, reacting to both the stored EUR value and
  // the active rate (target switches re-render all amounts).
  watch(
    () => [deps.getStoredValue(), deps.siglaRef()],
    () => {
      binding.local = deps.toDisplay(deps.getStoredValue());
    },
    { immediate: true, deep: false },
  );

  return binding;
}
