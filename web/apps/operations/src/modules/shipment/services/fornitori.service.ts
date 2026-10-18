import { http } from "./http";

export interface FornitoreOption {
  id_fornitore: number;
  name: string;
  rag_soc?: string;
  available?: boolean;
}

export interface ServiceOption {
  id_servizio_fornitore: number;
  id_servizio: number;
  description: string;
  available: boolean;
  price?: number;
}

/** A courier present on shipments, for the list's "filter by courier" dropdown. */
export interface ShipmentFornitoreOption {
  id: number;
  label: string;
  count: number;
}

interface ShipmentFornitoriEnvelope {
  success?: boolean;
  data?: { fornitori: ShipmentFornitoreOption[]; count: number };
}

export const fornitoriService = {
  /** spedy_ajax_lista_fornitori_box — list available couriers/fornitori for the shipment. */
  list(
    shipment_id: number,
  ): Promise<{ success: boolean; fornitori?: FornitoreOption[] }> {
    return http("/api_provider_box_compat", {
      query: { idd: shipment_id, froms: "ERP" },
    });
  },

  /**
   * set_fornitori_service — asignación MANUAL de un servicio del courier al
   * clicar una fila de la tabla de fornitori (paridad legacy FornSet →
   * spedy_update_forn_set.php).
   *
   * Persiste id_fornitore + id_servizio_fornitore (= id de la fila clicada) +
   * los costes/derivados de ESA fila. NO toca id_servizio (el servicio
   * comercial se mantiene, exactamente como el legacy).
   *
   * El controller (spedy_update_forn_set) espera nombres cortos legacy:
   *   id, idf, idsf, cst, fuel, psf, cdfrn, prvl, valrt, apizona.
   */
  async setService(
    shipment_id: number,
    p: {
      id_fornitore: number;
      id_servizio_fornitore: number;
      cst?: number;
      fuel?: number;
      psf?: number;
      cdfrn?: string;
      prvl?: string;
      valrt?: number;
      apizona?: string;
    },
  ): Promise<{ success: boolean; error?: string; etxt?: string }> {
    // El controller legacy (spedy_update_forn_set) NO devuelve {success}:
    // responde el array posicional {0:1, 1:"OK", err, etxt, ...}. El éxito se
    // determina por err==0 (y etxt vacío), no por un flag success.
    const raw = await http<{
      err?: number | string;
      etxt?: string;
      [k: string]: unknown;
    }>("/api_shipment_set_service", {
      method: "POST",
      body: {
        id: shipment_id,
        idf: p.id_fornitore,
        idsf: p.id_servizio_fornitore,
        cst: p.cst,
        fuel: p.fuel,
        psf: p.psf,
        cdfrn: p.cdfrn,
        prvl: p.prvl,
        valrt: p.valrt,
        apizona: p.apizona,
      },
    });
    const etxt = String(raw?.etxt ?? "").trim();
    const err = Number(raw?.err ?? 0);
    return { success: err === 0 && etxt === "", etxt: etxt || undefined };
  },

  /** spedy_ajax_lista_servizi — list services for the currently selected fornitore. */
  listServices(
    shipment_id: number,
  ): Promise<{ success: boolean; services?: ServiceOption[] }> {
    return http("/api_service_list_compat", {
      query: { idd: shipment_id, froms: "ERP" },
    });
  },

  /**
   * The couriers that actually appear on shipments, for the list's
   * "filter by courier" autocomplete. Sourced from the shipments themselves
   * (every real courier), ordered by frequency.
   *
   * Backend: /api_shipment_fornitori (Web_Shipment_Fornitori_Controller).
   */
  async listShipmentFornitori(): Promise<ShipmentFornitoreOption[]> {
    const res = await http<ShipmentFornitoriEnvelope>(
      "/api_shipment_fornitori",
      {},
    );
    return res?.data?.fornitori ?? [];
  },
};
