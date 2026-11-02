import { http } from './http';
import { unwrap } from './normalizers';
import { errorText, type RawApiError } from '../../utils/apiError';

export interface SedeLite {
  id: number;
  id_anagrafica: number;
  ragione_sociale?: string;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  prov?: string;
  paese?: string;
  mail?: string;
  PEC?: string;
  stato?: string;
  [k: string]: unknown;
}

const ENDPOINT = '/api_anagrafica_addresses';

export const sediInterneService = {
  async listByPartner(anagraficaId: number): Promise<SedeLite[]> {
    if (!anagraficaId || anagraficaId <= 0) return [];
    try {
      const raw = await http<unknown>(ENDPOINT, {
        query: { id_anagrafica: anagraficaId },
      });
      const arr = unwrap<SedeLite[]>(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  },

  async getById(id: number): Promise<SedeLite | null> {
    if (!id) return null;
    try {
      const raw = await http<unknown>(ENDPOINT, { query: { id } });
      return unwrap<SedeLite>(raw) ?? null;
    } catch {
      return null;
    }
  },

  async create(idAnagrafica: number, payload: Partial<SedeLite>): Promise<SedeLite | null> {
    const raw = await http<{ data?: SedeLite; error?: RawApiError }>(ENDPOINT, {
      method: 'POST',
      body: { ...payload, id_anagrafica: idAnagrafica },
    });
    if (raw?.error) throw new Error(errorText(raw.error));
    return raw?.data ?? null;
  },

  async update(id: number, payload: Partial<SedeLite>): Promise<SedeLite | null> {
    const raw = await http<{ data?: SedeLite; error?: RawApiError }>(ENDPOINT, {
      method: 'PUT',
      query: { id },
      body: { id, ...payload },
    });
    if (raw?.error) throw new Error(errorText(raw.error));
    return raw?.data ?? null;
  },

  async remove(id: number): Promise<void> {
    const raw = await http<{ error?: RawApiError }>(ENDPOINT, {
      method: 'DELETE',
      query: { id },
    });
    if (raw?.error) throw new Error(errorText(raw.error));
  },

  /**
   * Marca una sede como sede de facturación por defecto del cliente
   * (anagrafiche.id_sedi_interna_fatt). Paridad legacy "SedeLegal" / sedef icon.
   * Ruta hybrid: api_anagrafica_set_default_address (PUT).
   */
  async setDefault(idAnagrafica: number, idSede: number): Promise<void> {
    const raw = await http<{ error?: RawApiError }>('/api_anagrafica_set_default_address', {
      method: 'PUT',
      body: { id_anagrafica: idAnagrafica, id_sede: idSede },
    });
    if (raw?.error) throw new Error(errorText(raw.error));
  },

  filterClientSide(items: SedeLite[], query: string): SedeLite[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => {
      const haystack = [s.ragione_sociale, s.indirizzo, s.citta, s.cap, s.prov]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q) || String(s.id) === q;
    });
  },
};
