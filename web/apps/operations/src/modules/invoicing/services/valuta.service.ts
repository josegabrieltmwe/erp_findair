import { http } from "./http";

export interface ValutaLite {
  id?: number | string;
  sigla: string;
  nome?: string;
}

interface ValutaListResponse {
  success: boolean;
  data?: ValutaLite[];
  error?: string;
}

export const valutaService = {
  /**
   * Lista de divisas (tabla `valute`) desde el endpoint maestro
   * `api_master_currencies` (Web_Valute_Controller). Devuelve sigla + nome.
   */
  async list(): Promise<ValutaLite[]> {
    const r = await http<ValutaListResponse>("/api_master_currencies", {
      query: { per_page: 500 },
    });
    return (r.data ?? []).filter((v) => !!v.sigla);
  },
};
