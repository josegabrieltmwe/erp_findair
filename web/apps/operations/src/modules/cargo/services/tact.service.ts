import { http } from "./http";

/**
 * TACT IATA tact rate lookup. Modern endpoint already exists:
 *
 *   - POST /api_cargo_tact_update    Tact_Update_Controller (via RabbitMQ)
 *
 * Replaces the legacy inline Vue component embedded in spedyc_form.php
 * (lines 2625-2843) with a proper SPA-native flow.
 */

export interface TactResult {
  tact?: number;
  minimum_charge?: number;
  weight_charge?: number;
  carrier_matched?: string;
  rate_type?: string;
  effective_date?: string;
  currency_code?: string;
}

export interface TactLookupResponse {
  success: boolean;
  data?: TactResult;
  error_code?: string | null;
  error?: string;
  details?: {
    shipment_id?: number;
    origin?: string;
    destination?: string;
    requested_carrier?: string;
    available_carriers?: string[];
  };
}

interface LookupInput {
  shipmentId: number;
  carrier?: string;
}

export const tactService = {
  async lookup(input: LookupInput): Promise<TactLookupResponse> {
    try {
      const body: Record<string, unknown> = { id: input.shipmentId };
      if (input.carrier) body.carrier = input.carrier;
      const r = await http<TactLookupResponse>("/api_cargo_tact_update", {
        method: "POST",
        body,
      });
      return r;
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        error_code: "NETWORK_ERROR",
      };
    }
  },
};
