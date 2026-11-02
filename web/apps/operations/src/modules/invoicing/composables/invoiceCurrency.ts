import { computed, ref } from "vue";
import {
  currenciesService,
  type CurrencyOption,
} from "@shared/anagrafiche/services/currencies.service";

/**
 * Moneda de una factura manual o de proveedor (H10b). Antes `valuta_sigla` iba fijo a "EUR" y los
 * importes se mostraban siempre con "EUR". El catalogo sale de las valute; sin catalogo queda EUR.
 */
export const DEFAULT_INVOICE_CURRENCY = "EUR";

/** Siglas unicas en mayuscula, EUR primero y el resto por orden alfabetico. */
export function currencyCodes(list: ReadonlyArray<Pick<CurrencyOption, "sigla">>): string[] {
  const set = new Set<string>([DEFAULT_INVOICE_CURRENCY]);
  for (const c of list) {
    const s = String(c.sigla ?? "").trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(s)) set.add(s);
  }
  const rest = [...set].filter((s) => s !== DEFAULT_INVOICE_CURRENCY).sort();
  return [DEFAULT_INVOICE_CURRENCY, ...rest];
}

export function formatInvoiceAmount(v: number | null | undefined, currency: string): string {
  const n = Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n} ${currency || DEFAULT_INVOICE_CURRENCY}`;
}

export function useInvoiceCurrency() {
  const currency = ref(DEFAULT_INVOICE_CURRENCY);
  const catalog = ref<CurrencyOption[]>([]);
  const options = computed(() => currencyCodes(catalog.value));

  async function load(): Promise<void> {
    if (catalog.value.length > 0) return;
    try {
      catalog.value = await currenciesService.list();
    } catch {
      /* sin catalogo solo se ofrece EUR; el servidor valida la sigla */
    }
  }
  function reset(): void {
    currency.value = DEFAULT_INVOICE_CURRENCY;
  }
  const money = (v: number): string => formatInvoiceAmount(v, currency.value);

  return { currency, options, load, reset, money };
}
