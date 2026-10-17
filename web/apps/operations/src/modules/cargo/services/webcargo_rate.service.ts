import { http } from "./http";

/**
 * WebCargo rate detail service. Reads the cached rate data from the
 * Webcargo cache by `short_id`. Mirrors the legacy
 * `api_cargo_webcargo_rate_detail` endpoint used by cargo_flight_manager.js.
 *
 * The cache has a TTL — when expired the response carries `success=false`
 * and the SPA falls back to the booking-only render path if a booking is
 * still active.
 */

export interface WebcargoRate {
  short_id: string;
  airline_code?: string;
  airline_name?: string;
  /**
   * Fuente de la tarifa. Incluye las de KLM (`klm_quote` = quote firme,
   * `klm` = tarifa de contrato): el gestor de vuelo hidrata desde las dos
   * caches, no solo desde la de WebCargo.
   */
  source?: "realtime" | "published" | "express" | "klm_quote" | "klm";
  price?: number;
  client_price?: number;
  currency?: string;
  route?: {
    origin?: string;
    destination?: string;
    jumps?: string[];
  };
  transit_hours?: number;
  direct_flight?: boolean;
  stopovers?: number;
  departure?: string;
  arrival?: string;
  valid_from?: string;
  valid_to?: string;
  bookable?: boolean;
  not_bookable_reason?: string;
  /**
   * Cut-off (latest acceptance) de la aerolinea, ISO con offset.
   *
   * En `klm_quote` es el REAL (`routing.latestAcceptanceTs`); en `realtime`
   * sale de un parametro que enviamos nosotros y por eso llega acompañado de
   * `last_acceptance_estimated: true`. Mostrarlos igual haria pasar una
   * estimacion propia por un compromiso de la aerolinea.
   */
  last_acceptance_ts?: string;
  last_acceptance_estimated?: boolean;
  rate_data?: unknown;
  /** Some shapes (legacy fallback) flag a non-cached rate id. */
  _legacy?: boolean;
  [key: string]: unknown;
}

interface RateDetailResponse {
  success: boolean;
  rate?: WebcargoRate;
  error?: string;
}

/** Modern short_id format used by the cache: `wc_<9 alphanumerics>`. */
export function isModernShortId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^wc_[a-zA-Z0-9]{9}$/.test(id);
}

export const webcargoRateService = {
  /**
   * Fetch the full rate detail by short_id. Returns null when the cache
   * has expired or the id is malformed; the caller should render the
   * booking-only path instead.
   */
  async getRateDetail(shortId: string): Promise<WebcargoRate | null> {
    if (!isModernShortId(shortId)) {
      // Legacy / non-cacheable id — return a thin placeholder mirroring
      // what cargo_flight_manager.js does in that branch.
      return {
        short_id: shortId,
        airline_code: "",
        airline_name: "Flight selected (legacy)",
        route: { origin: "", destination: "" },
        _legacy: true,
      };
    }
    try {
      const r = await http<RateDetailResponse>(
        "/api_cargo_webcargo_rate_detail",
        {
          query: { short_id: shortId },
        },
      );
      if (r?.success && r.rate) {
        // Parse string rate_data eagerly so consumers don't have to.
        if (typeof r.rate.rate_data === "string") {
          try {
            r.rate.rate_data = JSON.parse(r.rate.rate_data);
          } catch {
            /* leave as string */
          }
        }
        return r.rate;
      }
      return null;
    } catch {
      return null;
    }
  },
};
