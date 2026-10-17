import { http } from "./http";

/**
 * Carrier offer row stored in `spedizioni_cargo_off`. Backend column
 * names are kept verbatim so any column the parent
 * `Cargo_Offer_Service::update_offer` whitelists can be patched without
 * extending this interface.
 */
export interface CargoOffer {
  id: number;
  id_cargo: number;
  id_partner?: number | null;
  id_vettore?: number | null;
  vettore_sigla?: string | null;
  vettore_nome?: string | null;
  costo?: number | string | null;
  change_valuta?: string | null;
  change_rate?: number | string | null;
  data_rich?: string | null;
  data_risp?: string | null;
  /** DB enum is ('S','N') — 'X' is NOT a valid value for this column. */
  controllata?: "S" | "N" | string;
  /** X=pending · M=migliore · B=buona · D=media · A=alta · C=cara */
  valutazione?: "X" | "M" | "B" | "D" | "A" | "C" | string | null;
  accettata?: "S" | "N";
  txt_richiesta?: string | null;
  txt_risposta?: string | null;
  txt_schedule?: string | null;
  rif_vettore?: string | null;
  note_interne?: string | null;
  file_name1?: string | null;
  file_name2?: string | null;
  file_name3?: string | null;
  file_name4?: string | null;
  otp?: string | null;
  pesor?: number | string | null;
  insert_datetime?: string | null;
  [k: string]: unknown;
}

export interface OffersListResponse {
  success: boolean;
  data?: {
    cargo_id: number;
    offers: CargoOffer[];
    count: number;
  };
  error?: string;
}

export interface OfferDetailResponse {
  success: boolean;
  data?: CargoOffer & { details?: unknown[] };
  error?: string;
}

export interface OfferCreate {
  cargo_id: number;
  id_vettore?: number;
  vettore_sigla?: string;
  costo?: number;
  change_valuta?: string;
  txt_richiesta?: string;
  pesor?: number;
  [k: string]: unknown;
}

export interface OfferPatch {
  /** ID is provided in the request body — the legacy router expects it there. */
  id: number;
  costo?: number;
  change_valuta?: string;
  change_rate?: number;
  data_risp?: string;
  controllata?: "S" | "N";
  valutazione?: "X" | "M" | "B" | "D" | "A" | "C";
  accettata?: "S" | "N";
  txt_risposta?: string;
  txt_schedule?: string;
  note_interne?: string;
  rif_vettore?: string;
  pesor?: number;
  [k: string]: unknown;
}

export interface DistributeRfqRequest {
  cargo_id: number;
  carriers: string[];
  rfq_text?: string;
  /** Shipment file ids to attach to every RFQ email (G4). */
  file_ids?: number[];
}

export interface DistributeRfqResponse {
  success: boolean;
  data?: { cargo_id: number; sent: number; errors: Record<string, string> };
  error?: string;
  message?: string;
}

const BASE = "/api_cargo_offers";

export const cargoOffersService = {
  /** GET /api_cargo_offers?cargo_id=N */
  list(cargo_id: number): Promise<OffersListResponse> {
    return http<OffersListResponse>(BASE, { query: { cargo_id } });
  },

  /** GET /api_cargo_offers?id=N → detailed record with `details[]`. */
  get(offer_id: number): Promise<OfferDetailResponse> {
    return http<OfferDetailResponse>(BASE, { query: { id: offer_id } });
  },

  /** POST /api_cargo_offers (creates a single offer row). */
  create(body: OfferCreate): Promise<{
    success: boolean;
    data?: { id: number; cargo_id: number };
    error?: string;
  }> {
    return http(BASE, { method: "POST", body }) as Promise<{
      success: boolean;
      data?: { id: number; cargo_id: number };
      error?: string;
    }>;
  },

  /**
   * POST /api_cargo_offers with `action=distribute` — fans out an email
   * RFQ to every carrier sigla. The backend writes one offer row per
   * carrier and triggers the legacy CRGOFF template via the mail queue.
   */
  distribute(body: DistributeRfqRequest): Promise<DistributeRfqResponse> {
    return http<DistributeRfqResponse>(BASE, {
      method: "POST",
      body: { ...body, action: "distribute" },
    });
  },

  /** PUT /api_cargo_offers — body carries `{id, ...patch}`. */
  update(
    body: OfferPatch,
  ): Promise<{ success: boolean; data?: { id: number }; error?: string }> {
    return http(BASE, { method: "PUT", body }) as Promise<{
      success: boolean;
      data?: { id: number };
      error?: string;
    }>;
  },

  /** DELETE /api_cargo_offers?id=N (soft-delete: stato='O'). */
  remove(offer_id: number): Promise<{ success: boolean; error?: string }> {
    return http(BASE, {
      method: "DELETE",
      query: { id: offer_id },
    }) as Promise<{ success: boolean; error?: string }>;
  },
};
