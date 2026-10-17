import { http } from "./http";
import type { ApiEnvelope } from "./api.types";

/**
 * Cargo per-kg price (profit) recompute.
 *
 * Wraps Web_Cargo_Profit_Controller (route api_cargo_profit). The
 * legacy spedyc_cargo_profit.php was an axLoaderScript pipe-delimited
 * endpoint; this returns structured JSON. Mutates
 * spedizioni_cargo_dett.costo_unit when the recompute yields a
 * different price than the stored one.
 *
 * NOTE: response surfaces commercial margin data (new_price_per_kg).
 * The UI must gate the button behind an internal-operator check.
 */

export interface CargoProfitResult {
  cargo_id: number;
  chargeable_weight: number;
  gross_weight: number;
  volumetric_weight: number;
  coeff_volm: number;
  pesor_locked: boolean;
  old_price_per_kg: number;
  new_price_per_kg: number;
  changed: boolean;
}

export const profitService = {
  /** POST api_cargo_profit {cargo_id} → recompute + maybe update. */
  recompute(cargo_id: number): Promise<ApiEnvelope<CargoProfitResult>> {
    return http<ApiEnvelope<CargoProfitResult>>("/api_cargo_profit", {
      method: "POST",
      body: { cargo_id },
    });
  },
};
