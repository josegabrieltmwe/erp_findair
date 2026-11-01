import { http } from './http';
import { currenciesFromPublic } from './publicCatalogs';

/**
 * Currencies (valute) — global master table. Populates the `valuta_sigla`
 * select of a client (parity with the legacy `$pll_valuta_sigla`, which read
 * `SELECT id, sigla, nome FROM valute WHERE sigla!='AAA' ORDER BY sigla`).
 *
 * Endpoint: /get-api-currencies (Currency_Controller, public_oauth): lo puede leer cualquier perfil. El mantenimiento de
 * monedas (packages/platform/currencies) sigue usando /api_master_currencies, que exige `master_data` (internos).
 */
export interface CurrencyOption {
  id: number;
  sigla: string;
  nome?: string;
  [k: string]: unknown;
}

const ENDPOINT = '/get-api-currencies';

export const currenciesService = {
  async list(): Promise<CurrencyOption[]> {
    return currenciesFromPublic(await http<unknown>(ENDPOINT, {}));
  },
};
