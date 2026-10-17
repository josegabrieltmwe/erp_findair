import { http } from './http';
import type { ApiEnvelope } from './api.types';

/**
 * EUR exchange-rate table for a given date.
 *
 * Wraps api_currency_day → Currency_Day_Controller (parity v7). Replaces
 * the legacy currency_day_box.php HTML rendering.
 */

export interface CurrencyRate {
  sigla: string;
  nome: string;
  rate_per_eur: number | null;
}

export interface CurrencyDayPayload {
  requested_date: string;
  effective_date: string;
  is_fallback: boolean;
  base: 'EUR';
  rates: CurrencyRate[];
  count: number;
}

/**
 * Target currency of a client (the sigla its partner-titolare invoices in).
 * Wraps ajax_partner_currency → Partner_Currency_Controller (legacy
 * partner_currency.php / Money_TRG). Returns a flat ajax envelope.
 */
export interface PartnerCurrencyResult {
  success: boolean;
  found: boolean;
  sigla: string;
  name: string;
  id_client: number;
  id_titolare: number;
}

export const currencyService = {
  /** GET api_currency_day?date=YYYY-MM-DD */
  getDayRates(date?: string): Promise<ApiEnvelope<CurrencyDayPayload>> {
    return http<ApiEnvelope<CurrencyDayPayload>>('/api_currency_day', {
      query: date ? { date } : {},
    });
  },

  /** GET ajax_partner_currency?id_client=N — target sigla of the client. */
  getTargetCurrency(idClient: number): Promise<PartnerCurrencyResult> {
    return http<PartnerCurrencyResult>('/ajax_partner_currency', {
      query: { id_client: idClient },
    });
  },
};
