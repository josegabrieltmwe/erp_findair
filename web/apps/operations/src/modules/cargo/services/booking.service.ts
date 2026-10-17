import { http } from "./http";
import { providerForBookingId } from "./booking_provider";

/**
 * WebCargo booking service. Talks to the modern controllers in
 * controller/web/cargo/booking/:
 *
 *   - POST   /api_cargo_webcargo_booking          create booking
 *   - GET    /api_cargo_webcargo_booking          retrieve by shipment_id or booking_id
 *   - POST   /api_cargo_webcargo_booking_cancel   cancel + refund flow
 *   - GET    /api_cargo_webcargo_booking_status   refresh status on-demand
 *   - GET    /api_cargo_webcargo_booking_detail   full detail (segments, fees, history)
 *   - GET    /api_cargo_webcargo_booking_history  audit trail
 *   - GET    /api_cargo_webcargo_evidence_ticket  boarding-pass JPG
 *
 * Source of truth: spedizioni_cargo.id_rate_webcargo, .webcargo_booking_id,
 * .webcargo_booking_status. The SPA cargo.store already loads those when it
 * loads the cargo row.
 *
 * Mocking: backend honors `use_testing` flag for non-prod. Pass it via
 * `book({ useTesting: true })` to hit the WebCargo sandbox.
 */

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "rejected"
  | "completed"
  | "failed"
  | string;

export interface BookingSummary {
  booking_id?: string;
  shipment_id?: number;
  short_id?: string;
  awb_number?: string;
  /** Carrier IATA code of the booked flight (KLM/Webcargo booking DTO). */
  airline_code?: string;
  status?: BookingStatus;
  created_at?: string;
  cancelled_at?: string | null;
  /**
   * Latest acceptance time (LAT) — the moment the carrier stops accepting the
   * cargo. Used to warn (never to block) when a cancellation is running late.
   * WebCargo only: KLM does not return an equivalent we persist.
   */
  latest_acceptance_at?: string | null;
  raw?: Record<string, unknown>;
}

export interface BookingDetail extends BookingSummary {
  segments?: BookingSegment[];
  fees?: BookingFee[];
  history?: BookingHistoryEntry[];
  computed?: Record<string, unknown>;
  status_reason?: string | null;
  confirmed_at?: string | null;
  cancel_reason?: string | null;
  time_of_availability_at?: string | null;
  origin_terminal?: string | null;
  destination_terminal?: string | null;
  origin_address?: string | null;
  destination_address?: string | null;
  product_code?: string | null;
  product_description?: string | null;
  commodity_class?: string | null;
  commodity_description?: string | null;
  chargeable_weight_kg?: number | null;
  agent_iata_confirmed?: string | null;
  known_shipper?: boolean | null;
  co2e_gt_kg?: number | null;
  co2e_gw_kg?: number | null;
  co2e_ew_kg?: number | null;
  co2e_et_kg?: number | null;
  quotation?: Quotation | null;
  credential_account?: CredentialAccount | null;
}

export interface BookingSegment {
  flight_number?: string;
  carrier?: string;
  origin?: string;
  destination?: string;
  departure?: string;
  arrival?: string;
  aircraft?: string;
}

export interface BookingFee {
  code?: string;
  name?: string;
  amount?: number;
  currency?: string;
}

export interface BookingHistoryEntry {
  ts?: string;
  event?: string;
  user_id?: number;
  details?: Record<string, unknown>;
}

export interface QuotationComponent {
  code?: string | null;
  name?: string | null;
  supplier_amount?: number | null;
  client_amount?: number | null;
}

/**
 * The rate quotation that produced this booking — the immutable snapshot
 * captured at cargo_booking_rate_snapshots when the operator selected this
 * rate, matched to the booking via short_id/canonical_rate_id. Null when no
 * matching snapshot exists (legacy or manually-created bookings).
 */
export interface Quotation {
  rate_id?: string | null;
  selected_at?: string | null;
  quote_valid_until?: string | null;
  is_firm_quote?: boolean;
  currency?: string | null;
  supplier_total?: number | null;
  client_total?: number | null;
  margin_percent?: number | null;
  chargeable_weight_kg?: number | null;
  components?: QuotationComponent[];
  pricing_incomplete?: boolean;
}

export type CredentialRelationship =
  | "credential_owner"
  | "represented_partner"
  | "house"
  | "unknown";

/**
 * Who owns the credential this booking was placed with — backend plan
 * docs/plan/booking-detail-credential-partner.md. `relationship` is what
 * keeps this honest: for WebCargo realtime delegation, the resolved partner
 * is the DQ (represented party), NEVER asserted as the owner of the AV
 * billing agreement — see that plan's §1 for why that distinction exists.
 * `partner_id`/`partner_name` are null for external OAuth callers even when
 * `resolved` is true (server-side authorization gate).
 */
export interface CredentialAccount {
  source?: string | null;
  ref_id?: number | null;
  relationship?: CredentialRelationship;
  label?: string | null;
  is_house?: boolean;
  resolved?: boolean;
  active?: boolean;
  partner_id?: number | null;
  partner_name?: string | null;
}

export interface BookResult {
  success: boolean;
  booking?: BookingSummary;
  error?: string;
  error_code?: string;
  /**
   * Resultado DESCONOCIDO: el RPC expiró y el carrier pudo crear la reserva sin
   * que viéramos la respuesta. NO es un fallo — reintentar a ciegas puede
   * producir una segunda reserva real con un segundo AWB.
   */
  indeterminate?: boolean;
  /** La respuesta describe una simulación (dry run), no una reserva real. */
  simulated?: boolean;
}

export interface CancelResult {
  success: boolean;
  cancelled_at?: string;
  error?: string;
  error_code?: string;
  /**
   * Resultado DESCONOCIDO: el RPC expiró y el carrier pudo cancelar sin que
   * viéramos la respuesta. NO es un fallo — reintentar a ciegas puede cancelar
   * dos veces, y algunos carriers penalizan la cancelación tardía.
   */
  indeterminate?: boolean;
  /** El carrier permite resolverlo consultando estado (WebCargo sí, KLM no). */
  resolvable_via_status?: boolean;
}

export interface BookInput {
  shipmentId: number;
  /** Realtime / current rate identifier from the flight search results. */
  shortId?: string;
  /** Legacy fallback when the rate comes from the published XML pipeline. */
  legacyRateId?: number;
  /**
   * Immutable priced version the operator accepted at selection time. When
   * present it wins over `shortId` on the backend: the shipment's ACTIVE
   * selection gets booked (validated server-side against Cargo_Current_Rate_
   * Selection), not whatever the mutable rate cache happens to hold right now
   * — closing the gap where selecting froze a price but booking re-read a
   * potentially different one from cache.
   */
  pricingSnapshotId?: string;
  /**
   * Reused from the earlier rate selection when available, so a retried
   * booking click maps to the same request instead of minting a new one.
   * Only meaningful together with `pricingSnapshotId`.
   */
  idempotencyKey?: string;
  /** Número de AWB a usar. Lo lleva tanto el modo `manual` como el `pool`. */
  awbManual?: string;
  /**
   * De dónde sale el AWB. `carrier` (defecto) deja que lo emita la aerolínea;
   * `pool` consume uno del stock del partner de la credencial; `manual` usa el
   * número de `awbManual`. Omitirlo con un `awbManual` presente se interpreta
   * como `manual`, por compatibilidad con los clientes que ya existían.
   */
  awbMode?: "carrier" | "pool" | "manual";
  /** WebCargo sandbox toggle. Honored only when allowed by env. */
  useTesting?: boolean;
}

interface CancelInput {
  bookingId: string;
  reason?: string;
}

export const bookingService = {
  async book(input: BookInput): Promise<BookResult> {
    try {
      const body: Record<string, unknown> = { shipment_id: input.shipmentId };
      // pricingSnapshotId wins on the backend when present — short_id/
      // legacyRateId are still sent for older backends and for logging, but
      // the modern path resolves the booking from the shipment's active
      // selection, not from these.
      if (input.pricingSnapshotId) {
        body.pricing_snapshot_id = input.pricingSnapshotId;
        if (input.idempotencyKey) body.idempotency_key = input.idempotencyKey;
      }
      if (input.shortId) body.short_id = input.shortId;
      if (input.legacyRateId) body.legacy_rate_id = input.legacyRateId;
      if (input.awbManual) body.awb_manual = input.awbManual;
      // El backend decide con esto de dónde sale el AWB; sin el campo,
      // un body con `awb_manual` se resuelve a modo manual (Awb_Mode).
      if (input.awbMode) body.awb_mode = input.awbMode;
      if (input.useTesting) body.use_testing = true;

      const r = await http<BookResult & { success: boolean }>(
        "/api_cargo_webcargo_booking",
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

  async getByShipmentId(shipmentId: number): Promise<BookingSummary | null> {
    try {
      const r = await http<{ success: boolean; booking?: BookingSummary }>(
        "/api_cargo_webcargo_booking",
        { query: { shipment_id: shipmentId } },
      );
      return r?.booking ?? null;
    } catch {
      return null;
    }
  },

  /** Legacy parity: cargo_flight_manager.js calls GET ?short_id=X. */
  async getByShortId(shortId: string): Promise<BookingSummary | null> {
    if (!shortId) return null;
    try {
      const r = await http<{ success: boolean; booking?: BookingSummary }>(
        "/api_cargo_webcargo_booking",
        { query: { short_id: shortId } },
      );
      return r?.booking ?? null;
    } catch {
      return null;
    }
  },

  async cancel(input: CancelInput): Promise<CancelResult> {
    try {
      const r = await http<CancelResult>("/api_cargo_webcargo_booking_cancel", {
        method: "POST",
        body: { booking_id: input.bookingId, reason: input.reason ?? "" },
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

  /** Force status refresh from WebCargo (calls GET /booking remote). */
  async refreshStatus(bookingId: string): Promise<BookingSummary | null> {
    try {
      const r = await http<{ success: boolean; booking?: BookingSummary }>(
        "/api_cargo_webcargo_booking_status",
        { query: { booking_id: bookingId } },
      );
      return r?.booking ?? null;
    } catch {
      return null;
    }
  },

  async getDetail(bookingId: string): Promise<BookingDetail | null> {
    // Klm_Booking_Detail_Controller mirrors the WebCargo endpoint's response
    // contract field-for-field (booking/segments/fees/history/computed/
    // quotation) even though the two read from structurally different
    // sources — WebCargo has its own segments/fees tables, KLM parses them
    // out of the raw carrier response. Same shape in, same shape out, so
    // this is the only carrier-aware branch in the whole method.
    const endpoint =
      providerForBookingId(bookingId) === "klm"
        ? "/api_cargo_klm_booking_detail"
        : "/api_cargo_webcargo_booking_detail";
    try {
      // The backend returns { booking, segments, fees, history, computed,
      // quotation } as SIBLING keys — booking itself only carries the
      // present_booking() fields. Returning just r.booking silently dropped
      // every one of those siblings; nothing downstream errored; the modal
      // just never had segments/fees/history/computed/quotation to render.
      const r = await http<{
        success: boolean;
        booking?: BookingDetail;
        segments?: BookingSegment[];
        fees?: BookingFee[];
        computed?: Record<string, unknown>;
        quotation?: Quotation | null;
        credential_account?: CredentialAccount | null;
      }>(endpoint, {
        query: { booking_id: bookingId },
      });
      if (!r?.booking) return null;
      return {
        ...r.booking,
        segments: r.segments ?? [],
        fees: r.fees ?? [],
        computed: r.computed ?? {},
        quotation: r.quotation ?? null,
        credential_account: r.credential_account ?? null,
      };
    } catch {
      return null;
    }
  },

  async getHistory(bookingId: string): Promise<BookingHistoryEntry[]> {
    // Same carrier routing as getDetail() — a klm_book_ id sent to the
    // WebCargo history endpoint resolves the booking fine via the dispatcher
    // but silently returns an empty history array, since that endpoint reads
    // webcargo_booking_history, a table KLM bookings are never written to.
    const endpoint =
      providerForBookingId(bookingId) === "klm"
        ? "/api_cargo_klm_booking_history"
        : "/api_cargo_webcargo_booking_history";
    try {
      const r = await http<{
        success: boolean;
        history?: BookingHistoryEntry[];
      }>(endpoint, {
        query: { booking_id: bookingId },
      });
      return Array.isArray(r?.history) ? r!.history! : [];
    } catch {
      return [];
    }
  },

  /** Returns a window.open URL for the boarding-pass JPG. */
  evidenceTicketUrl(bookingId: string): string {
    return `/bff/v1/api_cargo_webcargo_evidence_ticket?booking_id=${encodeURIComponent(bookingId)}`;
  },
};
