import { http } from "./http";

/**
 * Partners ERP seleccionables como DESTINATARIO de un envío de expedición.
 *
 * Backend: /api_selectable_partners (Web_Selectable_Partners_Controller),
 * anagrafiche WHERE erp_partner='S' AND tipo='P' AND stato='A'.
 *
 * Pensado para autocomplete REMOTO: `search()` consulta a medida que el
 * operador teclea, sin descargar todos los partners de golpe.
 */
export interface SelectablePartner {
  id: number;
  label: string;
}

interface PartnersEnvelope {
  success?: boolean;
  data?: { partners: SelectablePartner[]; count: number };
}

export const selectablePartnersService = {
  async search(term = "", limit = 30): Promise<SelectablePartner[]> {
    const res = await http<PartnersEnvelope>("/api_selectable_partners", {
      query: { search: term, limit: String(limit) },
    });
    return res?.data?.partners ?? [];
  },
};
