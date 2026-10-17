import { http } from "./http";

/**
 * Express shipment partner visibility CRUD.
 *
 * Wraps Web_Shipment_Partner_Controller (route api_shipment_partners).
 * Mirror of cargo_express partners.service.ts but for `spedizioni`.
 * The primary partner is resolved server-side through
 * fornitori_accnt.id_account (legacy convention).
 */

export type PartnerSlot = "titolare" | "primary" | "show1" | "show2";

export interface PartnerEntry {
  role: PartnerSlot;
  anagrafica_id: number;
  rag_soc: string;
}

export interface PartnerVisibilityPayload {
  shipment_id: number;
  partners: PartnerEntry[];
  available_slots: number;
  can_add: boolean;
  mutation?: {
    action: "add" | "remove";
    slot: "id_partner_show1" | "id_partner_show2";
    partner_id: number;
  };
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string;
}

export const partnersService = {
  /** GET api_shipment_partners?shipment_id=N */
  list(shipment_id: number): Promise<ApiEnvelope<PartnerVisibilityPayload>> {
    return http<ApiEnvelope<PartnerVisibilityPayload>>(
      "/api_shipment_partners",
      {
        query: { shipment_id },
      },
    );
  },

  add(
    shipment_id: number,
    partner_id: number,
  ): Promise<ApiEnvelope<PartnerVisibilityPayload>> {
    return http<ApiEnvelope<PartnerVisibilityPayload>>(
      "/api_shipment_partners",
      {
        method: "POST",
        body: { shipment_id, action: "add", partner_id },
      },
    );
  },

  remove(
    shipment_id: number,
    partner_id: number,
  ): Promise<ApiEnvelope<PartnerVisibilityPayload>> {
    return http<ApiEnvelope<PartnerVisibilityPayload>>(
      "/api_shipment_partners",
      {
        method: "POST",
        body: { shipment_id, action: "remove", partner_id },
      },
    );
  },
};
