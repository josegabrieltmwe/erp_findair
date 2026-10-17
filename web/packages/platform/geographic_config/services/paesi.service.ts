import { http } from '../../anagrafiche/services/http';
import { unwrap } from '../../anagrafiche/services/normalizers';

export interface PaeseLite {
  id: number;
  ISO: string;       // 2-letter country code (AL, IT, NL, US...) — the real ISO-3166-1 alpha-2
  ISO2: string;      // secondary subdivision code (US states: AK, AL...); NULL for countries
  nome: string;      // Italian name
  nomeEN?: string;   // English name
  attivo?: 'S' | 'N';
  [k: string]: unknown;
}

const ENDPOINT = '/api_master_countries';

export const paesiService = {
  /** Load the full list of active countries (cached client-side). */
  async list(): Promise<PaeseLite[]> {
    const raw = await http<unknown>(ENDPOINT);
    const arr = unwrap<PaeseLite[]>(raw);
    return Array.isArray(arr) ? arr : [];
  },

  /** Single country by id (rarely needed since list is cached). */
  async getById(id: number): Promise<PaeseLite | null> {
    if (!id) return null;
    try {
      const raw = await http<unknown>(ENDPOINT, { query: { id } });
      const r = unwrap<PaeseLite | PaeseLite[]>(raw);
      if (Array.isArray(r)) return r[0] ?? null;
      return r ?? null;
    } catch {
      return null;
    }
  },
};
