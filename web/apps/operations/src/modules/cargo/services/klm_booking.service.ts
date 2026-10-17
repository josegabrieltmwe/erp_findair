/**
 * KLM booking service. Mirror of booking.service.ts but talks to the KLM
 * controllers in controller/api/cargo/booking/ (backend already complete):
 *
 *   - POST /api_cargo_klm_booking          create booking
 *   - POST /api_cargo_klm_booking_cancel   cancel
 *   - GET  /api_cargo_klm_booking_history  audit trail
 *
 * Reuses the WebCargo booking types (BookInput / BookResult / BookingSummary)
 * so the store can route by rate `source` without duplicating the shapes.
 * The KLM rate short_id carries the `klm_` prefix; the backend resolves the
 * cached rate and runs the quote→book flow.
 */
import { http } from "./http";
import type { BookInput, BookResult, BookingSummary } from "./booking.service";

export const klmBookingService = {
  async book(input: BookInput): Promise<BookResult> {
    try {
      const body: Record<string, unknown> = { shipment_id: input.shipmentId };
      // pricingSnapshotId wins on the backend when present — see the same
      // comment in booking.service.ts. quote_id is deliberately never sent
      // from here: the driver re-derives it from the resolved short_id.
      if (input.pricingSnapshotId) {
        body.pricing_snapshot_id = input.pricingSnapshotId;
        if (input.idempotencyKey) body.idempotency_key = input.idempotencyKey;
      }
      if (input.shortId) body.short_id = input.shortId;
      if (input.awbManual) body.awb_manual = input.awbManual;
      // El backend decide con esto de dónde sale el AWB; sin el campo,
      // un body con `awb_manual` se resuelve a modo manual (Awb_Mode).
      if (input.awbMode) body.awb_mode = input.awbMode;
      if (input.useTesting) body.use_testing = true;

      const r = await http<BookResult & { success: boolean }>(
        "/api_cargo_klm_booking",
        { method: "POST", body },
      );
      return r;
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        error_code: "NETWORK_ERROR",
      };
    }
  },

  /**
   * Active booking for a KLM rate, by its `klm_` short_id.
   *
   * Mirrors bookingService.getByShortId(). Without it the store could only
   * hydrate WebCargo bookings, so an existing KLM booking was invisible after
   * a page reload: the card showed a flight with no booking and refused to
   * re-book the rate without explaining why.
   *
   * Returns null both when there is no active booking and on error — the
   * caller treats "no booking" as the normal case.
   */
  async getByShortId(shortId: string): Promise<BookingSummary | null> {
    if (!shortId) return null;
    try {
      const r = await http<{ success: boolean; booking?: BookingSummary }>(
        "/api_cargo_klm_booking",
        { query: { short_id: shortId } },
      );
      return r?.booking ?? null;
    } catch {
      return null;
    }
  },

  async cancel(bookingId: string, reason?: string): Promise<BookResult> {
    try {
      const r = await http<BookResult & { success: boolean }>(
        "/api_cargo_klm_booking_cancel",
        { method: "POST", body: { booking_id: bookingId, reason } },
      );
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

export type { BookingSummary };
