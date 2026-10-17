import { http } from "./http";

export interface PianoContoLite {
  id: number | string;
  descr: string;
  codice?: string;
}

interface PianoContoListResponse {
  success: boolean;
  data?: PianoContoLite[];
  error?: string;
}

export const pianoContoService = {
  /**
   * Lista del piano dei conti (tabla `piano_conti`) desde el endpoint maestro
   * `api_master_chart_of_accounts_web` (Web_Piano_Conti_Controller, hybrid auth).
   * Devuelve id + descr (+ codice opcional para mostrar).
   */
  async list(): Promise<PianoContoLite[]> {
    const r = await http<PianoContoListResponse>(
      "/api_master_chart_of_accounts_web",
      {
        query: { per_page: 500 },
      },
    );
    return (r.data ?? []).filter((p) => p.id !== undefined && p.id !== null);
  },
};
