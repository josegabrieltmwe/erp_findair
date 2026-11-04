import { http } from '../../anagrafiche/services/http';
import { unwrap } from '../../anagrafiche/services/normalizers';
import { currenciesFromPublic } from '../../anagrafiche/services/publicCatalogs';

export interface ValutaLite {
  id: number;
  sigla: string;       // EUR, USD, GBP
  nome: string;
  cambioEUR?: number;
  [k: string]: unknown;
}

/**
 * El selector de moneda de tarifas lo usan también los partners: se lee del catálogo PÚBLICO
 * (`get-api-currencies`, trae id, sigla, nome y cambioEUR del día), como las anagrafiche. `api_master_currencies`
 * exige `master_data` (internos) y al partner le respondía 403 con el desplegable vacío.
 */
const PUBLIC_ENDPOINT = '/get-api-currencies';
const ENDPOINT = '/api_master_currencies';

export const valuteService = {
  async list(): Promise<ValutaLite[]> {
    return currenciesFromPublic(await http<unknown>(PUBLIC_ENDPOINT, {})) as ValutaLite[];
  },

  async getById(id: number): Promise<ValutaLite | null> {
    if (!id) return null;
    try {
      const raw = await http<unknown>(ENDPOINT, { query: { id } });
      const r = unwrap<ValutaLite | ValutaLite[]>(raw);
      if (Array.isArray(r)) return r[0] ?? null;
      return r ?? null;
    } catch {
      return null;
    }
  },
};
