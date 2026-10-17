import { http } from "./http";

export interface AnagraficaLite {
  id: number | string;
  rag_soc: string;
  pi_cf?: string;
  nome_breve?: string | null;
  tipo?: "C" | "F" | "P" | string;
  stato?: "A" | "D" | string;
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
   * Búsqueda de clientes para el autocomplete de facturación. Usa el endpoint
   * dedicado `api_invoice_clients` (módulo `fatturazione`, filtrado por partner)
   * en vez de `api_anagrafica_crud` (módulo `anagrafiche`) — este último da 403
   * a las cuentas de partner B2B, que no tienen grant de anagrafiche.
   */
  async search(text: string, perPage = 25): Promise<AnagraficaLite[]> {
    const q = text.trim();
    const params: Record<string, string | number> = { per_page: perPage };
    if (q) params.search = q;
    const r = await http<AnagraficaListResponse>("/api_invoice_clients", {
      query: params,
    });
    return r.data ?? [];
  },

  /**
   * Búsqueda de partners ERP (`erp_partner = 'S'`) por nombre o NIF, para el
   * ámbito de una regla fiscal. No filtra por `tipo`: el emisor TMWE (id 1)
   * es de tipo I, y `tipo = 'P'` incluye corresponsales que no facturan. Usa
   * el CRUD de anagrafiche: solo los operadores de TMWE lo tienen (los
   * partners no crean reglas).
   */
  async searchPartners(text: string, perPage = 25): Promise<AnagraficaLite[]> {
    const q = text.trim();
    const params: Record<string, string | number> = {
      per_page: perPage,
      erp_partner: "S",
    };
    if (q) params.search = q;
    const r = await http<AnagraficaListResponse>("/api_anagrafica_crud", {
      query: params,
    });
    return r.data ?? [];
  },

  /** Una anagrafica por id. */
  async getById(id: number): Promise<AnagraficaLite | null> {
    if (!id || id <= 0) return null;
    try {
      const r = await http<{ success: boolean; data?: AnagraficaLite }>(
        "/api_anagrafica_crud",
        { query: { id } },
      );
      return r.data ?? null;
    } catch {
      return null;
    }
  },
};
