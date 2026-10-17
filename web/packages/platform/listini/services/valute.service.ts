import { http } from '../../anagrafiche/services/http';
import { unwrap } from '../../anagrafiche/services/normalizers';

export interface ValutaLite {
  id: number;
  sigla: string;       // EUR, USD, GBP
  nome: string;
  cambioEUR?: number;
  [k: string]: unknown;
}

const ENDPOINT = '/api_master_currencies';

export const valuteService = {
  async list(): Promise<ValutaLite[]> {
    const raw = await http<unknown>(ENDPOINT);
    const arr = unwrap<ValutaLite[]>(raw);
    return Array.isArray(arr) ? arr : [];
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
