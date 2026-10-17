import { http } from './http';

export interface AnagraficaLite {
  id: number | string;
  rag_soc: string;
  pi_cf?: string;
  nome_breve?: string | null;
  tipo?: 'C' | 'F' | 'P' | string;
  stato?: 'A' | 'D' | string;
  id_paese_iso?: string;
  citta?: string;
  prov?: string;
  valuta_sigla?: string;
}

export interface AnagraficaListResponse {
  success: boolean;
  data?: AnagraficaLite[];
  pagination?: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
  error?: string;
}

export const anagraficaService = {
  /**
   * Free-text search of anagrafiche (clients, suppliers, partners). Hits
   * api_anagrafica_crud?search=... per the convention used by admin_config V2.
   */
  async search(text: string, perPage = 25): Promise<AnagraficaLite[]> {
    const q = text.trim();
    const params: Record<string, string | number> = { per_page: perPage };
    if (q) params.search = q;
    const r = await http<AnagraficaListResponse>('/api_anagrafica_crud', { query: params });
    return r.data ?? [];
  },

  /** Fetch a single anagrafica by id. */
  async getById(id: number): Promise<AnagraficaLite | null> {
    if (!id || id <= 0) return null;
    try {
      const r = await http<{ success: boolean; data?: AnagraficaLite }>(
        '/api_anagrafica_crud',
        { query: { id } },
      );
      return r.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Internal sites (sedi_interne) of a client, for the sede selector.
   * Hits api_anagrafica_addresses?id_anagrafica=... (hybrid auth). Returns []
   * on error so the caller can degrade gracefully.
   */
  async sedes(idAnagrafica: number): Promise<AnagraficaSede[]> {
    if (!idAnagrafica || idAnagrafica <= 0) return [];
    try {
      const r = await http<{ success: boolean; data?: AnagraficaSede[] }>(
        '/api_anagrafica_addresses',
        { query: { id_anagrafica: idAnagrafica } },
      );
      return r.data ?? [];
    } catch {
      return [];
    }
  },
};

export interface AnagraficaSede {
  id: number | string;
  id_anagrafica: number | string;
  label: string;
  indirizzo?: string;
  citta?: string;
  cap?: string;
  prov?: string;
  id_paese_iso?: string;
}
