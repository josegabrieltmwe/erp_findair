import { http } from './http';

/**
 * Currencies (valute) — global master table. Populates the `valuta_sigla`
 * select of a client (parity with the legacy `$pll_valuta_sigla`, which read
 * `SELECT id, sigla, nome FROM valute WHERE sigla!='AAA' ORDER BY sigla`).
 *
 * Endpoint: /api_master_currencies (Web_Valute_Controller, hybrid auth).
 */
export interface CurrencyOption {
  id: number;
  sigla: string;
  nome?: string;
  [k: string]: unknown;
}

const ENDPOINT = '/api_master_currencies';

function unwrapList<T>(raw: unknown): T[] {
  const r = raw as { data?: T[]; items?: T[] } | null;
  if (Array.isArray(r?.data)) return r!.data as T[];
  if (Array.isArray(r?.items)) return r!.items as T[];
  return [];
}

export const currenciesService = {
  async list(): Promise<CurrencyOption[]> {
    const raw = await http<unknown>(ENDPOINT, {});
    // Filtra el placeholder 'AAA' del legacy y ordena por sigla.
    return unwrapList<CurrencyOption>(raw)
      .filter((c) => c.sigla && c.sigla !== 'AAA')
      .sort((a, b) => a.sigla.localeCompare(b.sigla));
  },
};
