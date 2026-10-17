import { http } from "./http";
import type { ShipmentSupplement } from "./shipment.types";

export interface SupplementsUpsertResult {
  success: boolean;
  supplements?: ShipmentSupplement[];
  error?: string;
}

/**
 * Modern response of `ajax_shipment_supplements?op=prices`.
 * Each `*_cliente` / `*_forn` map has supplement_id → EUR amount.
 *
 *  - `list_*`  — listino price (computed by Supplement_Orchestrator_Service)
 *  - `fix_*`   — fixed price stored in spedizioni_suppl.fix_priceC / fix_priceF
 */
export interface SupplementsPricesData {
  shipment_id: number;
  currency: string;
  list_cliente: Record<string, number>;
  fix_cliente: Record<string, number>;
  list_forn: Record<string, number>;
  fix_forn: Record<string, number>;
  calculated_at: string;
}

export interface SupplementsPricesResult {
  success: boolean;
  data?: SupplementsPricesData;
  error?: string;
}

export interface SupplementsListResult {
  success: boolean;
  data?: {
    shipment_id: number;
    supplements: ShipmentSupplement[] | Record<string, ShipmentSupplement>;
    count: number;
  };
  error?: string;
}

export const supplementsService = {
  /**
   * ajax_shipment_supplements GET — fetch just the active supplements for
   * a shipment. Used for an optimistic partial refresh after add/remove so
   * we don't reload the whole shipment (packages + files + supplements),
   * which added a ~4s lag that made a successful add look like it failed.
   */
  list(shipment_id: number): Promise<SupplementsListResult> {
    return http<SupplementsListResult>("/ajax_shipment_supplements", {
      query: { shipment_id },
    });
  },

  /** ajax_shipment_supplements POST — set the list of active supplements. */
  upsertAll(
    shipment_id: number,
    supplements: Partial<ShipmentSupplement>[],
  ): Promise<SupplementsUpsertResult> {
    return http<SupplementsUpsertResult>("/ajax_shipment_supplements", {
      method: "POST",
      body: { shipment_id, supplements },
    });
  },

  /**
   * Modern bulk pricing endpoint — computes listino prices for every
   * supplement on the shipment in a single call. Returns both client
   * (`list_cliente`) and supplier (`list_forn`) sides, plus any fixed
   * overrides stored in spedizioni_suppl.
   *
   * This replaces the legacy `supplcalcola` endpoint that returned a
   * single supplement at a time. Callers that need to refresh one row
   * read the map by supplement id instead of issuing N calls.
   *
   * Backend: `Shipment_Supplements_Controller::handle_get_prices` →
   * `Supplement_Orchestrator_Service::calculate_dual_supplements`.
   */
  prices(
    shipment_id: number,
    currency: string = "EUR",
  ): Promise<SupplementsPricesResult> {
    return http("/ajax_shipment_supplements", {
      query: { op: "prices", shipment_id, currency },
    });
  },

  /**
   * Recompute the price for one supplement. Thin compatibility wrapper
   * over `prices()` for callers (e.g. the "recompute" pencil button)
   * that only care about a single row.
   *
   * Looks the value up locally in the bulk response instead of hitting
   * the server N times. `quale='C'` returns the client-side amount,
   * `quale='F'` returns the supplier-side amount.
   */
  async calculate(
    shipment_id: number,
    id_supplemento: number,
    quale: "C" | "F" = "C",
  ): Promise<{ success: boolean; prezzo?: number; error?: string }> {
    const r = await this.prices(shipment_id);
    if (!r.success || !r.data) {
      return { success: false, error: r.error ?? "Price computation failed" };
    }
    const map = quale === "F" ? r.data.list_forn : r.data.list_cliente;
    const key = String(id_supplemento);
    const prezzo = map[key];
    return { success: true, prezzo: typeof prezzo === "number" ? prezzo : 0 };
  },
};
