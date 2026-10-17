import { http } from "./http";
import type { ApiEnvelope } from "./api.types";

/**
 * Cargo partner visibility CRUD.
 *
 * Wraps Web_Cargo_Partner_Controller (route api_cargo_partners).
 * The legacy duo spedyc_partners_box.php + spedyc_partners_exe.php
 * is fully replaced by this single REST endpoint.
 */

export type PartnerSlot = "titolare" | "primary" | "show1" | "show2";

export interface PartnerEntry {
  role: PartnerSlot;
  anagrafica_id: number;
  rag_soc: string;
}

export interface PartnerVisibilityPayload {
  cargo_id: number;
  partners: PartnerEntry[];
  available_slots: number;
  can_add: boolean;
  mutation?: {
    action: "add" | "remove";
    slot: "id_partner_show1" | "id_partner_show2";
    partner_id: number;
  };
}

export const partnersService = {
  /** GET api_cargo_partners?cargo_id=N */
  list(cargo_id: number): Promise<ApiEnvelope<PartnerVisibilityPayload>> {
    return http<ApiEnvelope<PartnerVisibilityPayload>>("/api_cargo_partners", {
      query: { cargo_id },
    });
  },

  /** POST api_cargo_partners {cargo_id, action:'add', partner_id} */
  add(
    cargo_id: number,
    partner_id: number,
  ): Promise<ApiEnvelope<PartnerVisibilityPayload>> {
    return http<ApiEnvelope<PartnerVisibilityPayload>>("/api_cargo_partners", {
      method: "POST",
      body: { cargo_id, action: "add", partner_id },
    });
  },

  /** POST api_cargo_partners {cargo_id, action:'remove', partner_id} */
  remove(
    cargo_id: number,
    partner_id: number,
  ): Promise<ApiEnvelope<PartnerVisibilityPayload>> {
    return http<ApiEnvelope<PartnerVisibilityPayload>>("/api_cargo_partners", {
      method: "POST",
      body: { cargo_id, action: "remove", partner_id },
    });
  },
};
