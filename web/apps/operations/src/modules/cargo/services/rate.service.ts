import { http } from "./http";

/**
 * Cargo rate selection service. Wires the two-step "assign flight to
 * cargo" workflow from the legacy form (flight_search_dialog.js):
 *
 *   - POST /api_cargo_rate_clear   { shipment_id }
 *     Clears the rate currently associated with the cargo. Safe to call
 *     even if nothing is selected.
 *
 *   - POST /api_cargo_rate_select
 *       { shipment_id, pricing_snapshot_id, idempotency_key, replace_current? }
 *     Associates a flight rate with the cargo. Writes `idunivoco_volo` and
 *     the flight columns on spedizioni_cargo, freezing the exact priced
 *     version the operator accepted. With `replace_current` the previous
 *     flight is cleared in the same transaction (flight change). The legacy
 *     `short_id` form is rejected by the API (VALIDATION_ERROR).
 *
 * **Important**: selecting a rate does NOT create a WebCargo booking.
 * Booking is a separate downstream action — see booking.service.ts.
 *
 * Paridad con legacy flight_search_dialog.js confirmSelection().
 */

export interface RateOpResult {
  success: boolean;
  error?: string;
  /** Código estable (QUOTE_EXPIRED, ALREADY_SELECTED, SNAPSHOT_REQUIRED…). */
  error_code?: string;
  data?: unknown;
}

export const rateService = {
  /** Clear the rate currently associated with the cargo. */
  async clear(shipmentId: number): Promise<RateOpResult> {
    try {
      const r = await http<RateOpResult>("/api_cargo_rate_clear", {
        method: "POST",
        body: { shipment_id: shipmentId },
      });
      return r;
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },

  /**
   * Associate a rate with the cargo.
   *
   * Prefers `pricingSnapshotId` when the backend supplied one. A `short_id`
   * points at a MUTABLE cache row, so what ends up attached to the shipment is
   * whatever that row holds at selection time — not necessarily the price the
   * operator was looking at. A pricing snapshot id points at one immutable
   * priced version, which is what makes "the price you saw is the price you
   * get" true rather than usually true.
   *
   * Falls back to `short_id` while the backend runs in legacy or shadow mode,
   * where no snapshot is produced.
   */
  async select(input: {
    shipmentId: number;
    pricingSnapshotId?: string;
    /**
     * Cambio de vuelo: la API vacía el vuelo anterior dentro de la misma
     * transacción que aplica el nuevo. Si algo falla, la expedición conserva
     * el vuelo que tenía (antes: rate_clear + rate_select por separado).
     */
    replaceCurrent?: boolean;
  }): Promise<RateOpResult> {
    // La API solo acepta `pricing_snapshot_id`: seleccionar por `short_id`
    // leía una fila de caché mutable y responde VALIDATION_ERROR.
    if (!input.pricingSnapshotId) {
      return {
        success: false,
        error: "pricing_snapshot_id is required",
        error_code: "SNAPSHOT_REQUIRED",
      };
    }
    const body: Record<string, unknown> = {
      shipment_id: input.shipmentId,
      pricing_snapshot_id: input.pricingSnapshotId,
      // Retries must return the SAME selection instead of creating a second
      // one: a double click, a dropped connection or an impatient reload all
      // replay this request. Derived from the shipment and the snapshot so a
      // genuine retry reuses the key while a different choice gets a new one.
      idempotency_key: `sel-${input.shipmentId}-${input.pricingSnapshotId.slice(0, 32)}`,
    };
    if (input.replaceCurrent) body.replace_current = true;

    try {
      const r = await http<RateOpResult>("/api_cargo_rate_select", {
        method: "POST",
        body,
      });
      return r;
    } catch (e) {
      const err = e as Error & { errorCode?: string };
      return { success: false, error: err.message, error_code: err.errorCode };
    }
  },
};
