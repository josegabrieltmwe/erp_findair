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
 *       modern: { shipment_id, pricing_snapshot_id, idempotency_key }
 *       legacy: { shipment_id, short_id, extend_ttl }
 *     Associates a flight rate with the cargo. Writes `idunivoco_volo` and
 *     the flight columns on spedizioni_cargo.
 *
 *     The modern form freezes the exact priced version the operator accepted;
 *     the legacy form resolves a mutable cache row. Both are accepted while
 *     the backend rollout is in progress.
 *
 * **Important**: selecting a rate does NOT create a WebCargo booking.
 * Booking is a separate downstream action — see booking.service.ts.
 *
 * Paridad con legacy flight_search_dialog.js confirmSelection().
 */

export interface RateOpResult {
  success: boolean;
  error?: string;
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
    shortId?: string;
    pricingSnapshotId?: string;
  }): Promise<RateOpResult> {
    const body: Record<string, unknown> = { shipment_id: input.shipmentId };

    if (input.pricingSnapshotId) {
      body.pricing_snapshot_id = input.pricingSnapshotId;
      // Retries must return the SAME selection instead of creating a second
      // one: a double click, a dropped connection or an impatient reload all
      // replay this request. Derived from the shipment and the snapshot so a
      // genuine retry reuses the key while a different choice gets a new one.
      body.idempotency_key = `sel-${input.shipmentId}-${input.pricingSnapshotId.slice(0, 32)}`;
    } else if (input.shortId) {
      body.short_id = input.shortId;
      body.extend_ttl = true;
    } else {
      return {
        success: false,
        error: "pricing_snapshot_id or short_id is required",
      };
    }

    try {
      const r = await http<RateOpResult>("/api_cargo_rate_select", {
        method: "POST",
        body,
      });
      return r;
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};
