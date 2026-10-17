import { ref, computed, watch, type Ref } from 'vue';

/**
 * Target-currency layer for money amounts — shared by cargo and shipment.
 *
 * Money amounts are stored in EUR (canonical) but displayed/entered in the
 * client's *target* currency — the sigla its partner-titolare invoices in
 * (`anagrafiche.valuta_sigla`). Conversion uses the EUR rates of the shipment
 * date (`data_sped0`):
 *
 *   display (EUR → target):  round(eur   * rate, 2)
 *   input   (target → EUR):  round(value / rate, 4)   ← server also re-converts
 *
 * `rate` = "1 EUR = X target" (the cambioEUR convention). When the target is
 * EUR (or unresolved, e.g. no client), `isEur` is true and both helpers are
 * identity functions.
 *
 * Store-agnostic: the app injects how to read the client id / shipment date
 * (reactive getters) and how to fetch rates (the per-app currency service that
 * owns the app-specific `http`). Each app wraps this with a 1-line composable.
 */

export interface TargetCurrencyRateRow {
  sigla: string;
  rate_per_eur: number | null;
}

export interface TargetCurrencyDeps {
  /** Reactive getter for the shipment's client id (0 / falsy → no conversion). */
  getClientId: () => number | string | null | undefined;
  /** Reactive getter for the shipment date (data_sped0). */
  getShipmentDate: () => string | null | undefined;
  /** Resolve the client's target sigla (ajax_partner_currency). */
  getTargetCurrency: (clientId: number) => Promise<{ found?: boolean; sigla?: string; name?: string }>;
  /** Day rates table (api_currency_day). */
  getDayRates: (date?: string) => Promise<{ success?: boolean; data?: { rates: TargetCurrencyRateRow[] } }>;
}

export interface TargetCurrency {
  sigla: Ref<string>;
  name: Ref<string>;
  rate: Ref<number>;
  ready: Ref<boolean>;
  isEur: Ref<boolean>;
  toDisplay: (eur: number | string | null | undefined) => number;
  toEur: (display: number | string | null | undefined) => number;
  resolve: () => Promise<void>;
}

export function useTargetCurrency(deps: TargetCurrencyDeps): TargetCurrency {
  const sigla = ref<string>('EUR');
  const name = ref<string>('');
  const rate = ref<number>(1); // 1 EUR = `rate` target
  const ready = ref<boolean>(false);

  const isEur = computed(() => !ready.value || sigla.value === 'EUR' || rate.value <= 0);

  function round(n: number, dp: number): number {
    const f = 10 ** dp;
    return Math.round((n + Number.EPSILON) * f) / f;
  }

  function toDisplay(eur: number | string | null | undefined): number {
    const v = Number(eur ?? 0);
    if (isEur.value) return round(v, 2);
    return round(v * rate.value, 2);
  }

  function toEur(display: number | string | null | undefined): number {
    const v = Number(display ?? 0);
    if (isEur.value) return round(v, 4);
    return round(v / rate.value, 4);
  }

  let lastKey = '';

  async function resolve(): Promise<void> {
    const clientId = Number(deps.getClientId() ?? 0);
    const date = String(deps.getShipmentDate() ?? '').slice(0, 10);
    const key = `${clientId}|${date}`;
    if (key === lastKey) return; // avoid redundant refetches
    lastKey = key;

    ready.value = false;
    if (!clientId) {
      sigla.value = 'EUR';
      name.value = '';
      rate.value = 1;
      ready.value = true;
      return;
    }

    try {
      const target = await deps.getTargetCurrency(clientId);
      const sig = (target.found && target.sigla ? target.sigla : 'EUR').toUpperCase();
      sigla.value = sig;
      name.value = target.name ?? '';

      if (sig === 'EUR') {
        rate.value = 1;
        ready.value = true;
        return;
      }

      const day = await deps.getDayRates(date || undefined);
      const rates = day?.success && day.data ? day.data.rates : [];
      const hit = rates.find((r) => r.sigla.toUpperCase() === sig);
      rate.value = hit && hit.rate_per_eur && hit.rate_per_eur > 0 ? hit.rate_per_eur : 1;
      // Missing rate → fall back to EUR semantics so we never corrupt amounts.
      if (rate.value === 1 && sig !== 'EUR') {
        sigla.value = 'EUR';
      }
      ready.value = true;
    } catch {
      sigla.value = 'EUR';
      rate.value = 1;
      ready.value = true;
    }
  }

  watch(
    () => [deps.getClientId(), deps.getShipmentDate()],
    () => { void resolve(); },
    { immediate: true },
  );

  return { sigla, name, rate, ready, isEur, toDisplay, toEur, resolve };
}
