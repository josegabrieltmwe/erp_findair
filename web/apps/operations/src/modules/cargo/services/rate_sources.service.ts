import { http } from "./http";

/**
 * Which rate sources can be queried for a route, and with whose credential.
 *
 *   GET /web_cargo_rate_sources?origin=AMS&destination=IAH&shipment_id=N
 *       (wrapper de sesion sobre `api_cargo_rate_sources`: el endpoint
 *        OAuth exige Bearer y la SPA va con cookie)
 *   GET /api_airport_search?q=milano
 *
 * Both are asked BEFORE searching, and both exist to stop the form deciding in
 * silence: which sources are even possible for a route, and whether a quote
 * would go out on another partner's account.
 */

export type RateSourceKey =
  | "published"
  | "realtime"
  /** Cuenta directa de TMWE IT, saltándose la delegación de la ruta. */
  | "realtime_direct"
  | "klm"
  | "klm_quote";

export interface RateSourceAccount {
  /** `delegated` = the credential belongs to another partner. */
  mode: "own" | "delegated";
  /** Partner name, for the "by <partner>" label. Empty when own. */
  partner: string;
  label: string;
  ref_id: number | null;
}

/**
 * Una credencial entre las que el OPERARIO puede elegir para esta ruta.
 *
 * `reasons` explica POR QUE se ofrece: el partner del pais de salida
 * (`origin`), el del pais de llegada (`destination`), el partner que opera el
 * envio (`partner`) o la cuenta universal de la casa (`universal`).
 *
 * Solo existe en la vista del ERP: el cliente B2B no elige credencial ni la
 * conoce — para el la precedencia se aplica sola.
 */
export interface RateCredentialOption {
  /** 0 = cuenta directa de TMWE IT; >0 = fila de tmwe_webcargo_delegation. */
  delegation_id: number;
  mode: "own" | "delegated";
  partner: string;
  label: string;
  country: string;
  reasons: string[];
  /** La que resolvio la precedencia: se usa si no se elige otra cosa. */
  selected: boolean;
}

export interface RateSource {
  key: RateSourceKey;
  provider: "webcargo" | "klm";
  kind: "rates" | "quote";
  label: string;
  available: boolean;
  /** Why not, when `available` is false. */
  reason: string | null;
  account: RateSourceAccount | null;
  /**
   * Alternativas para el operario. Vacio salvo en `realtime`: es la unica
   * fuente cuya identidad se puede cambiar por peticion.
   */
  accounts?: RateCredentialOption[];
}

/** One problem found in the shipment's own data (weight, packages, route). */
export interface QuoteDataIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  detail?: Record<string, unknown>;
}

/**
 * Shipment data readiness. `valid: false` means at least one `error` issue: the
 * search endpoint answers 422 and no request is sent to the carrier.
 */
export interface QuoteDataValidation {
  valid: boolean;
  /** ISO-3 language used for the API's human-readable fallback messages. */
  language?: string;
  issues: QuoteDataIssue[];
  summary: {
    packages_source: "detail" | "header";
    packages_count: number;
    total_weight: number;
  };
}

export interface RateSourcesResponse {
  success: boolean;
  route: {
    origin: string;
    destination: string;
    origin_country: string;
    destination_country: string;
  };
  client_id: number;
  sources: RateSource[];
  /** null when the search is not bound to a shipment. */
  validation?: QuoteDataValidation | null;
}

export interface AirportItem {
  code: string;
  name: string;
  city: string;
  country: string;
  principal: boolean;
  /** Pre-built "AMS · Amsterdam Schiphol"; the dropdown should not rebuild it. */
  label: string;
}

export const rateSourcesService = {
  async forRoute(params: {
    origin?: string;
    destination?: string;
    shipmentId?: number;
  }): Promise<RateSourcesResponse> {
    return http<RateSourcesResponse>("/web_cargo_rate_sources", {
      query: {
        origin: params.origin ?? "",
        destination: params.destination ?? "",
        shipment_id: params.shipmentId ?? 0,
      },
    });
  },

  /**
   * Airport type-ahead. Matches IATA code AND name/city, which is what makes a
   * city with several airports usable — "milano" returns MXP, LIN and BGY.
   */
  async searchAirports(q: string, limit = 20): Promise<AirportItem[]> {
    if (!q || q.trim().length < 2) return [];
    const res = await http<{ items?: AirportItem[] }>("/api_airport_search", {
      query: { q: q.trim(), limit },
    });
    return res.items ?? [];
  },
};
