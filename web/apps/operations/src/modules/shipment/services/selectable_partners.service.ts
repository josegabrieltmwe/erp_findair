import { http } from "./http";

/**
 * Partners seleccionables como DESTINATARIO de un envío de expedición.
 *
 * Backend: /api_selectable_partners, anagrafiche tipo='P' activas, sean o no
 * `erp_partner` (con `scope=erp`, solo las erp_partner). Las ERP vienen primero.
 *
 * Pensado para autocomplete REMOTO: `search()` consulta a medida que el
 * operador teclea, sin descargar todos los partners de golpe.
 */
export interface SelectablePartner {
  id: number;
  label: string;
  paese?: string | null;
  /** true = partner del ERP. Ausente en APIs antiguas (que solo listaban ERP). */
  erp_partner?: boolean;
}

export type SelectablePartnerScope = "all" | "erp";

interface PartnersEnvelope {
  success?: boolean;
  data?: { partners: SelectablePartner[]; count: number };
}

export const selectablePartnersService = {
  async search(
    term = "",
    limit = 30,
    scope: SelectablePartnerScope = "all",
  ): Promise<SelectablePartner[]> {
    const res = await http<PartnersEnvelope>("/api_selectable_partners", {
      query: { search: term, limit: String(limit), scope },
    });
    return res?.data?.partners ?? [];
  },
};
