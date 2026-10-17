/**
 * WS-S-O — REST client for service selection (cliente + fornitore).
 *
 * Backed by the modern Web_* hybrid-auth controllers:
 *   - /unified_express_service_list_by_shipment  → list client services with price
 *   - /unified_rate_fornitore                    → list fornitori + their services
 *   - /api_express_service_select                → persist selection + cascade pricing
 *
 * Replaces the legacy direct calls to
 *   - /spedy_ajax_lista_servizi
 *   - /spedy_ajax_lista_fornitori_box
 * that fornitori.service.ts still uses (deprecated, to be removed once the
 * SPA fully migrates).
 */
import { http } from "./http";

/** One step of the pricing derivation trace (legacy DebugPrezzo). */
export interface RateTraceStep {
  timestamp_ms?: number;
  category: string;
  description: string;
  context?: Record<string, unknown>;
}

export interface RateDebugTrace {
  request_id?: string;
  steps: RateTraceStep[];
  total_time_ms?: number | null;
  total_steps?: number | null;
}

export interface ClientServiceOption {
  service_id: number;
  description: string;
  available: boolean;
  price?: number;
  fuel_surcharge?: number;
  currency?: string;
  fornitore_id?: number;
  fornitore_name?: string;
  id_servizio_fornitore?: number;
  delivery_date?: string | null;
  priority?: boolean;
  zone?: string;
  /** Step-by-step pricing derivation; only present when listed with debug=true. */
  debug_trace?: RateDebugTrace;
  [k: string]: unknown;
}

export interface FornitoreServiceOption {
  fornitore_id: number;
  fornitore_name: string;
  services: Array<{
    id_servizio_fornitore: number;
    description: string;
    cost: number;
    fuel_surcharge?: number;
    currency?: string;
    available: boolean;
    /** Reasons tokens from legacy multiinf[] (DSP, LKD, SNK, BNK, …). */
    unavailable_reasons?: string[];
    /** Delivery date "YYYY-MM-DD" (from live API when available, else estimated). */
    delivery_date?: string;
    /** Delivery hour "HH:MM" or "HH:MM:SS". */
    delivery_time?: string;
    /** True when delivery_date/time are calculated offline (no live API response). */
    is_estimated_delivery?: boolean;
    /** TMWE parent service id for the courier child (e.g. DHL 72 H10:30 → 55). */
    tmwe_service_id?: number;
    /** Priority service flag (servizi_fornitori.prioritario='S'). */
    prioritario?: boolean;
    /** Zone code resolved by the engine (legacy `zona`). */
    zone_code?: string;
    /** Step-by-step pricing derivation (legacy DebugPrezzo quale=F); only
     *  present when the list was requested with debug=true. */
    debug_trace?: RateDebugTrace;
    [k: string]: unknown;
  }>;
}

export interface ListClientResponse {
  success: boolean;
  data?: {
    shipment_id: number;
    services: ClientServiceOption[];
    total_services: number;
    cached?: boolean;
  };
  error?: string;
}

export interface ListFornitoreResponse {
  success: boolean;
  data?: {
    shipment_id: number;
    services: FornitoreServiceOption[] | Array<Record<string, unknown>>;
    total_services?: number;
  };
  error?: string;
}

export interface SelectServiceResponse {
  success: boolean;
  data?: {
    shipment_id: number;
    service_applied: boolean;
    service: { id?: number; description?: string } | null;
    price_locked: boolean;
    supplements_applied?: number;
    snapshot?: Record<string, unknown>;
  };
  error?: string;
  error_code?: string;
}

export const serviceSelectionService = {
  /** POST /unified_express_service_list_by_shipment */
  listClient(
    shipment_id: number,
    opts: {
      include_unavailable?: boolean;
      force_recalculate?: boolean;
      use_live_rates?: boolean;
      debug?: boolean;
    } = {},
  ): Promise<ListClientResponse> {
    return http<ListClientResponse>(
      "/unified_express_service_list_by_shipment",
      {
        method: "POST",
        body: {
          shipment_id,
          options: {
            include_unavailable: opts.include_unavailable ?? false,
            // The trace only exists on a fresh calc, so debug forces a recalc
            // (a cached result carries no trace).
            force_recalculate:
              opts.force_recalculate || opts.debug ? true : false,
            use_live_rates: opts.use_live_rates ?? true,
            debug: opts.debug ?? false,
          },
        },
      },
    );
  },

  /** POST /unified_rate_fornitore */
  listFornitore(
    shipment_id: number,
    opts: {
      include_unavailable?: boolean;
      use_live_rates?: boolean;
      debug?: boolean;
    } = {},
  ): Promise<ListFornitoreResponse> {
    return http<ListFornitoreResponse>("/unified_rate_fornitore", {
      method: "POST",
      body: {
        shipment_id,
        options: {
          include_unavailable: opts.include_unavailable ?? false,
          use_live_rates: opts.use_live_rates ?? false,
          // debug=true attaches a per-rate derivation trace (legacy
          // DebugPrezzo quale=F); the backend serves it from a separate cache.
          debug: opts.debug ?? false,
        },
      },
    });
  },

  /**
   * POST /api_express_service_select — persist client service + cascade
   * pricing. The backend computes the carico (client price), picks the
   * best fornitore (or honours the explicit one), persists id_servizio,
   * id_fornitore, id_servizio_fornitore, fuel_surc, costo_previsto, and
   * inserts default supplementi.
   */
  select(
    shipment_id: number,
    service_id: number,
    fornitore_id?: number,
    extra: Record<string, unknown> = {},
  ): Promise<SelectServiceResponse> {
    return http<SelectServiceResponse>("/api_express_service_select", {
      method: "POST",
      body: {
        shipment_id,
        service_id,
        ...(fornitore_id != null ? { fornitore_id } : {}),
        ...extra,
      },
    });
  },

  /** DELETE /api_express_service_select — clear the assignment. */
  clear(shipment_id: number): Promise<SelectServiceResponse> {
    return http<SelectServiceResponse>("/api_express_service_select", {
      method: "DELETE",
      query: { shipment_id },
    });
  },
};
