/**
 * Flight search service — talks to
 * `api_cargo_shipment_flight_search?mode=stream` (Web_Shipment_Flight_Search_Controller).
 *
 * Backend emits NAMED Server-Sent Events (not plain `message` events),
 * so `EventSource.onmessage` would miss them all. We use the same
 * approach the legacy `flight_search_dialog.js` uses: POST + fetch +
 * ReadableStream, manually parsing `event:` / `data:` lines.
 *
 * Event stream (from Unified_Webcargo_Rate_Controller doc):
 *   event: connected     data: { mode, time }
 *   event: permissions   data: { can_see_costs, can_see_prices }
 *   event: phase         data: { phase: 'published'|'realtime'|'express', status }
 *   event: progress      data: { phase, percent, phase_percent, completed, total, airline?, rates_received }
 *   event: rate          data: { airline, source, rates: [<canonical>], rates_count }
 *   event: rate_error    data: { airline, source, error }
 *   event: complete      data: { total_rates, duration_ms }
 *   event: error         data: { message }
 *
 * Each canonical rate has the shape produced by
 * `translate_published_rate_to_canonical()` plus realtime-specific
 * fields (direct_flight, stopovers, transit_hours, departure,
 * departure_time, segments[], flight_numbers[], short_id, …).
 */

import { isAbortLikeError } from "@tmwe/shared-frontend/http";
import { stripCarrierMarkup } from "./carrierName";

// `klm` = catalogue rate sheet (/sales/v1/rates); `klm_quote` = firm, bookable
// quote (generate-quotes). Same carrier, different guarantees: a quote carries
// real flight numbers and a total valid for ~15 minutes, a rate sheet is a
// season tariff with no flight assigned. They are shown side by side, the way
// WebCargo already pairs `published` with `realtime`.
export type FlightRateSource =
  | "published"
  | "realtime"
  | "express"
  | "klm"
  | "klm_quote";

/**
 * Which carrier system a rate came from.
 *
 * Orthogonal to how it can be bought: KLM serves both a season tariff and a
 * firm quote, and so does WebCargo (published vs realtime). Filtering by
 * `source` alone forced the operator to know which internal feed produced a
 * row, which is not how they think about the choice.
 */
export type FlightRateProvider = "klm" | "webcargo" | "express";

/**
 * How the rate can be acted on.
 *
 *  - `direct_booking` — a firm, bookable price: KLM quotes and WebCargo
 *    realtime. Carries a real routing and expires.
 *  - `published`      — a catalogue tariff: no flight assigned, no expiry
 *    beyond the season, not directly bookable.
 */
export type FlightRateKind = "direct_booking" | "published";

/**
 * Etiqueta corta de procedencia: proveedor + tipo, los dos ejes que importan.
 *
 *   WC  = WebCargo Rates      WCQ = WebCargo Quote
 *   KL  = KLM/AF Rates        KLQ = KLM/AF Quote
 *   EX  = Express
 *
 * Vive aqui y no en el componente porque hay dos sitios que la pintan —el
 * listado y el wizard de seleccion— y cuando cada uno tenia la suya, el wizard
 * seguia mostrando el esquema viejo (RT/EX/PUB): la misma tarifa se anunciaba
 * "KLQ" en la tabla y "PUB" al confirmarla.
 */
export function sourceShortLabel(s: string): string {
  if (s === "realtime") return "WCQ";
  if (s === "published") return "WC";
  if (s === "klm_quote") return "KLQ";
  if (s === "klm") return "KL";
  if (s === "express") return "EX";
  return "WC";
}

/** Color del chip de procedencia. Mismo criterio y mismo motivo que arriba. */
export function sourceColorFor(s: string): string {
  if (s === "realtime") return "success";
  if (s === "express") return "warning";
  // Cotizacion firme de KLM: tono mas profundo que la tarifa de catalogo, para
  // distinguirlas cuando ambas aparecen para la misma ruta.
  if (s === "klm_quote") return "deep-purple";
  if (s === "klm") return "indigo";
  return "primary";
}

const PROVIDER_BY_SOURCE: Record<FlightRateSource, FlightRateProvider> = {
  klm: "klm",
  klm_quote: "klm",
  published: "webcargo",
  realtime: "webcargo",
  express: "express",
};

const KIND_BY_SOURCE: Record<FlightRateSource, FlightRateKind> = {
  klm_quote: "direct_booking",
  realtime: "direct_booking",
  klm: "published",
  published: "published",
  express: "published",
};

/**
 * Codigos IATA de recargo → etiqueta legible. **Solo fallback.**
 *
 * KLM manda la descripcion en `chargeDesc` ("SAF Contribution"), asi que en el
 * caso normal esta tabla no se usa: el nombre viene del proveedor y es el suyo.
 * Sirve para fuentes que emiten el codigo pelado, y si tampoco acierta se cae
 * al propio codigo — preferible un codigo crudo a una fila sin etiqueta.
 */
const SURCHARGE_LABELS: Record<string, string> = {
  MU: "SAF (Sustainable Aviation Fuel)",
  XD: "War risk",
  MY: "Fuel surcharge",
  SC: "Security surcharge",
  AW: "AWB fee",
};

export function providerOf(source: FlightRateSource | string): FlightRateProvider {
  return PROVIDER_BY_SOURCE[source as FlightRateSource] ?? "webcargo";
}

export function kindOf(source: FlightRateSource | string): FlightRateKind {
  return KIND_BY_SOURCE[source as FlightRateSource] ?? "published";
}

export function isDirectBooking(source: FlightRateSource | string): boolean {
  return kindOf(source) === "direct_booking";
}

export interface FlightSegment {
  carrier?: string;
  flight_number?: string | number | null;
  origin?: string;
  destination?: string;
  vehicle?: string | null;
  departure?: string | null;
  arrival?: string | null;
}

/** Canonical rate as emitted by the SSE pipeline. We deliberately
 *  keep this loose — backend payloads carry extra nested objects
 *  (pricing, cost, client_price, margin, surcharges…) that the detail
 *  dialog may render verbatim. */
export interface FlightRate {
  /** Stable id for keying — short_id (realtime) or rate_id (published). */
  short_id?: string;
  unique_code?: string;
  rate_id?: string;
  airline_code: string;
  airline_name?: string;
  source: FlightRateSource;
  /**
   * Cuenta con la que se obtuvo esta tarifa (solo ERP).
   *
   * Ausente en el cliente B2B: el backend lo deja fuera de la whitelist de
   * visibilidad, asi que nunca llega al evento SSE externo.
   */
  account_ref?: {
    source?: string;
    ref_id?: number | null;
    label?: string;
  };
  /** Money: rate.client_price can be number (post-normalize) or object. */
  client_price?:
    | number
    | { total?: number; total_eur?: number; currency?: string };
  /** Supplier cost. */
  cost?: number | { total?: number; total_eur?: number; currency?: string };
  /** Legacy alias for cost.total. */
  price?: number;
  /** Display currency. */
  currency?: string;
  /** Routing summary. */
  direct_flight?: boolean;
  stopovers?: number;
  transit_hours?: number | null;
  departure?: string | null;
  departure_time?: string | null;
  arrival?: string | null;
  /** Validity (typically realtime). */
  valid_until?: string | null;
  /** Segments: backend uses three shapes — see segmentsFromRate(). */
  segments?: FlightSegment[];
  connection?: { connectionSegments?: { segment?: unknown[] } };
  flight_numbers?: Array<string | number>;
  route?: { jumps?: string[] };
  vehicles?: Array<string | null>;
  /** Optional pricing breakdown blocks (when can_see_costs). */
  pricing?: unknown;
  margin?: unknown;
  /** Catch-all so the detail dialog can render unknown fields. */
  [key: string]: unknown;
}

export interface FlightSearchParams {
  shipment_id: number;
  origin?: string;
  destination?: string;
  weight?: number;
  date?: string;
  packages_count?: number;
  include_published?: boolean;
  include_realtime?: boolean;
  include_realtime_direct?: boolean;
  /** Credenciales elegidas por el operario (0 = cuenta directa TMWE IT). */
  credential_ids?: number[];
  include_express?: boolean;
  include_klm?: boolean;
  /** Firm KLM quotes (generate-quotes). Defaults to include_klm server-side. */
  include_klm_quotes?: boolean;
  /**
   * Courier phases. The flight-search modal is air-freight only and offers no
   * toggle for them, but the server defaults both to true, so they must travel
   * as explicit false or they run on every search.
   */
  include_courier_live?: boolean;
  include_courier?: boolean;
  /** Partner credential explicitly accepted for this search (delegated source). */
  via_partner?: number;
}

export interface FlightSearchProgress {
  phase: string;
  percent: number;
  phase_percent: number;
  completed: number;
  total: number;
  rates_received: number;
  airline?: string | null;
}

export type FlightSearchEvent =
  | { type: "connected"; data: { mode?: string; time?: string } }
  | {
      type: "permissions";
      data: { can_see_costs?: boolean; can_see_prices?: boolean };
    }
  /**
   * Fase del backend. `status` es `started` al abrirla y `completed` al
   * cerrarla, y el cierre trae ADEMAS `total_rates` (0 incluido) y, si fallo,
   * `error`.
   *
   * El front descartaba todo salvo `phase`, y sin `status` no habia forma de
   * distinguir "esta fuente sigue buscando" de "termino sin traer nada": el
   * indicador por fuente tenia que adivinarlo contando tarifas, que es
   * justamente lo que hacia girar el spinner de una fuente ya terminada.
   */
  | {
      type: "phase";
      data: {
        phase: string;
        status: string;
        total_rates?: number;
        error?: string;
        skipped?: boolean;
      };
    }
  | { type: "progress"; data: FlightSearchProgress }
  | {
      type: "rate";
      airline: string;
      source: FlightRateSource;
      rates: FlightRate[];
      rates_count: number;
    }
  | {
      type: "rate_error";
      airline: string;
      source: FlightRateSource;
      error: string;
    }
  | { type: "complete"; data: { total_rates?: number; duration_ms?: number } }
  | { type: "error"; message: string };

interface StreamHandle {
  abort(): void;
}

/**
 * Open the SSE stream. POST + fetch (not EventSource) because:
 *   - backend emits NAMED events that EventSource.onmessage misses,
 *   - the route accepts override_* in the JSON body (override origin,
 *     destination, weight, date, packages…).
 */
export function openFlightSearchStream(
  params: FlightSearchParams,
  onEvent: (e: FlightSearchEvent) => void,
): StreamHandle {
  const controller = new AbortController();
  const body: Record<string, unknown> = { mode: "stream" };
  if (params.origin) body.override_origin = params.origin.toUpperCase();
  if (params.destination)
    body.override_destination = params.destination.toUpperCase();
  if (params.weight) body.override_weight = params.weight;
  if (params.date) body.override_date = params.date;
  if (params.packages_count) body.override_packages = params.packages_count;
  if (params.include_published !== undefined)
    body.include_published = params.include_published;
  if (params.include_realtime !== undefined)
    body.include_realtime = params.include_realtime;
  // La cuenta directa es una VARIANTE de realtime: activa la fase y le dice al
  // backend que ignore la delegación que resolvería la ruta.
  if (params.credential_ids?.length) {
    body.include_realtime = true;
    body.credential_ids = params.credential_ids;
  }
  if (params.include_realtime_direct === true) {
    body.include_realtime = true;
    body.force_direct_account = true;
  }
  if (params.include_express !== undefined)
    body.include_express = params.include_express;
  if (params.include_klm !== undefined) body.include_klm = params.include_klm;
  // Was missing: without it the server fell back to `include_klm`, so ticking
  // KLM/AF Rates silently pulled the (much slower) firm-quote phase along.
  if (params.include_klm_quotes !== undefined)
    body.include_klm_quotes = params.include_klm_quotes;
  if (params.include_courier_live !== undefined)
    body.include_courier_live = params.include_courier_live;
  if (params.include_courier !== undefined)
    body.include_courier = params.include_courier;

  const qs = new URLSearchParams({ shipment_id: String(params.shipment_id) });
  const url = `/bff/v1/api_cargo_shipment_flight_search?${qs.toString()}`;

  void (async (): Promise<void> => {
    try {
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok || !resp.body) {
        onEvent({ type: "error", message: `Stream HTTP ${resp.status}` });
        return;
      }
      await readEventStream(resp.body, onEvent);
    } catch (e) {
      // Raw fetch (SSE), not ofetch: here `err.name` IS 'AbortError'.
      // isAbortLikeError also covers the page-unload case, where the browser
      // kills the stream and the failure is not worth reporting.
      if (isAbortLikeError(e, controller.signal)) return;
      const err = e as { message?: string };
      onEvent({ type: "error", message: err.message ?? "Connection error" });
    }
  })();

  return { abort: () => controller.abort() };
}

/** Parse an SSE stream into typed events. */
async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (e: FlightSearchEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let currentEvent = "";
  let dataLines: string[] = [];

  const flushEvent = (): void => {
    if (!dataLines.length) {
      currentEvent = "";
      return;
    }
    const dataStr = dataLines.join("\n");
    dataLines = [];
    const type = currentEvent || "message";
    currentEvent = "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(dataStr);
    } catch {
      return;
    }
    dispatch(type, parsed as Record<string, unknown>, onEvent);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nlIdx: number;
    while ((nlIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nlIdx).replace(/\r$/, "");
      buffer = buffer.slice(nlIdx + 1);

      if (line === "") {
        flushEvent();
        continue;
      }
      if (line.startsWith(":")) continue; // SSE comment
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
  }
  // Flush any trailing event without a final blank line.
  if (dataLines.length) flushEvent();
}

function dispatch(
  type: string,
  data: Record<string, unknown>,
  onEvent: (e: FlightSearchEvent) => void,
): void {
  switch (type) {
    case "connected":
      onEvent({
        type: "connected",
        data: data as { mode?: string; time?: string },
      });
      return;
    case "permissions":
      onEvent({
        type: "permissions",
        data: data as { can_see_costs?: boolean; can_see_prices?: boolean },
      });
      return;
    case "phase":
      onEvent({
        type: "phase",
        data: data as { phase: string; status: string },
      });
      return;
    case "progress": {
      const p = data as Record<string, unknown>;
      onEvent({
        type: "progress",
        data: {
          phase: String(p.phase ?? ""),
          percent: Number(p.percent ?? 0),
          phase_percent: Number(p.phase_percent ?? 0),
          completed: Number(p.completed ?? 0),
          total: Number(p.total ?? 0),
          rates_received: Number(p.rates_received ?? 0),
          airline: (p.airline as string | null | undefined) ?? null,
        },
      });
      return;
    }
    case "rate": {
      const rates = Array.isArray(data.rates)
        ? (data.rates as FlightRate[])
        : [];
      onEvent({
        type: "rate",
        airline: String(data.airline ?? ""),
        source: (data.source as FlightRateSource) ?? "published",
        rates,
        rates_count: Number(data.rates_count ?? rates.length),
      });
      return;
    }
    case "rate_error":
      onEvent({
        type: "rate_error",
        airline: String(data.airline ?? ""),
        source: (data.source as FlightRateSource) ?? "published",
        error: String(data.error ?? data.message ?? "Rate error"),
      });
      return;
    case "complete":
      onEvent({
        type: "complete",
        data: data as { total_rates?: number; duration_ms?: number },
      });
      return;
    case "error":
      onEvent({
        type: "error",
        message: String(data.message ?? data.error ?? "Stream error"),
      });
      return;
  }
}

/** Stable key for grouping/dedup. */
export function rateKey(r: FlightRate): string {
  return String(
    r.short_id ??
      r.unique_code ??
      r.rate_id ??
      `${r.airline_code}|${r.source}|${r.departure ?? ""}|${r.price ?? ""}`,
  );
}

/** Unified surcharge item (realtime is flat, published is nested). */
export interface NormalizedSurcharge {
  code: string;
  name: string;
  amount: number;
  currency: string;
  type?: string;
}

/**
 * Normalized view used by the table/filters. Cross-source unification:
 *   - `_client_price_n` / `_cost_n` — always numbers, never objects.
 *   - `_chargeable_weight_n`, `_actual_weight_n`, `_volumetric_weight_n`
 *     — realtime puts these at top level; published has them under
 *       `pricing.base`. We surface both shapes here.
 *   - `_rate_per_kg_n` / `_minimum_charge_n` — same logic.
 *   - `_via[]` — realtime-only; published has it implicit in segments.
 *   - `_valid_from` / `_valid_to` — realtime has both; published only `valid_until`.
 *   - `_promotional`, `_product_name`, `_service_type`, `_notes` — realtime-only.
 *   - `_surcharges_n[]` — unified list regardless of source shape.
 */
export interface NormalizedRate extends FlightRate {
  /**
   * Id numerico estable, exigido por `ListingDataView` (contrato
   * `{ id: number }`). Las tarifas no traen id propio: se asigna al normalizar,
   * de forma incremental por sesion de busqueda.
   */
  id: number;
  /** Clave de identidad de la tarifa (`rateKey`), usada para la seleccion. */
  _rowKey: string;
  _client_price_n: number;
  _cost_n: number;
  _currency: string;
  _chargeable_weight_n: number;
  _actual_weight_n: number;
  _volumetric_weight_n: number;
  _rate_per_kg_n: number;
  _minimum_charge_n: number;
  _via: string[];
  _valid_from: string | null;
  _valid_to: string | null;
  _promotional: boolean;
  _product_name: string;
  _service_type: string;
  _notes: string;
  _surcharges_n: NormalizedSurcharge[];
  /** Por que la tarifa no es reservable (`SOLD_OUT`…). "" si lo es. */
  _not_bookable_reason: string;
  /**
   * Cut-off (latest acceptance) en ISO, o "" si la fuente no lo trae.
   *
   * `klm_quote` manda el REAL de la aerolinea; en `realtime` es orientativo
   * —sale de un parametro que enviamos en la peticion—, y por eso viene
   * acompañado de `_last_acceptance_estimated`. Mostrar los dos igual haria
   * pasar una estimacion por un compromiso firme.
   */
  _last_acceptance: string;
  _last_acceptance_estimated: boolean;
}

/**
 * Contador de filas. `ListingDataView` necesita un id numerico y las tarifas no
 * lo traen; antes se parcheaba `_rowKey` mutando las props desde un computed
 * del listado, un efecto secundario que se disparaba al renderizar.
 *
 * EL ID DEBE SER ESTABLE POR VUELO, no un correlativo de llamada.
 *
 * `ListingDataView` usa `:key="row.id"` en su `v-for`. Si el id de un vuelo
 * cambia, Vue DESTRUYE y recrea esa fila — y el boton que el operador esta
 * pulsando se desmonta a mitad del clic, asi que el evento se pierde y no
 * ocurre absolutamente nada: ni error, ni wizard, ni peticion.
 *
 * Y cambiaba constantemente: el stream SSE re-normaliza cada tarifa que se
 * actualiza (`rates.value[existing] = n`), y con `++rowSeq` estrenaba id en
 * cada pasada. Con 471 tarifas llegando, las filas se recreaban bajo el cursor.
 * Ese era el motivo real de que el boton Select "no hiciera nada".
 *
 * Ahora el id se deriva de la clave del vuelo y se memoriza: el mismo vuelo
 * conserva su id durante toda la busqueda.
 */
let rowSeq = 0;
const rowIds = new Map<string, number>();

/** Reinicia la numeracion al empezar una busqueda nueva. */
export function resetRowSeq(): void {
  rowSeq = 0;
  rowIds.clear();
}

/** Id numerico ESTABLE para un vuelo: mismo `_rowKey`, mismo id. */
function stableRowId(key: string): number {
  const known = rowIds.get(key);
  if (known !== undefined) {
    return known;
  }
  const next = ++rowSeq;
  rowIds.set(key, next);
  return next;
}

export function normalizeRate(raw: FlightRate): NormalizedRate {
  const key = rateKey(raw);
  const out: NormalizedRate = {
    ...raw,
    id: stableRowId(key),
    _rowKey: key,
    _client_price_n: 0,
    _cost_n: 0,
    _currency: "EUR",
    _chargeable_weight_n: 0,
    _actual_weight_n: 0,
    _volumetric_weight_n: 0,
    _rate_per_kg_n: 0,
    _minimum_charge_n: 0,
    _via: [],
    _valid_from: null,
    _valid_to: null,
    _promotional: false,
    _product_name: "",
    _service_type: "",
    _notes: "",
    _surcharges_n: [],
    _not_bookable_reason: "",
    _last_acceptance: "",
    _last_acceptance_estimated: false,
  };

  // ---- Airline flatten ----
  const air = (raw as { airline?: unknown }).airline;
  if (air && typeof air === "object") {
    const a = air as { code?: string; name?: string };
    out.airline_code = out.airline_code || a.code || "";
    out.airline_name = out.airline_name || a.name || "";
  }
  if (!out.airline_name) out.airline_name = out.airline_code;
  // Defensive: legacy WebCargo XML labels occasionally carry an HTML
  // <span>(product code)</span> tail. The modern picker should never
  // surface that markup as literal text. See utils/carrierName.ts.
  out.airline_name = stripCarrierMarkup(out.airline_name);

  // ---- Money: published shape (objects with .total + nested) ----
  if (typeof raw.client_price === "object" && raw.client_price !== null) {
    const cp = raw.client_price as {
      total?: number;
      total_eur?: number;
      currency?: string;
    };
    out._client_price_n = Number(cp.total ?? cp.total_eur ?? 0);
    out._currency = cp.currency ?? out._currency;
  } else if (typeof raw.client_price === "number") {
    out._client_price_n = raw.client_price;
  }
  if (typeof raw.cost === "object" && raw.cost !== null) {
    const c = raw.cost as { total?: number; currency?: string };
    out._cost_n = Number(c.total ?? 0);
    if (c.currency) out._currency = c.currency;
  } else if (typeof raw.cost === "number") {
    out._cost_n = raw.cost;
  } else if (typeof raw.price === "number") {
    out._cost_n = raw.price;
  }

  // ---- Money: realtime shape (flat total_charge) ----
  const rt = raw as Record<string, unknown>;
  if (!out._cost_n && typeof rt.total_charge === "number") {
    out._cost_n = rt.total_charge;
  }
  if (!out._client_price_n && typeof rt.total_charge === "number") {
    out._client_price_n = rt.total_charge;
  }
  if (raw.currency) out._currency = raw.currency;
  if (!out._client_price_n && out._cost_n) out._client_price_n = out._cost_n;
  if (!out._cost_n && out._client_price_n) out._cost_n = out._client_price_n;

  // ---- Weights: realtime top-level, fall back to published pricing.base ----
  const pricing = raw.pricing as
    | {
        base?: {
          chargeable_weight?: number;
          price_per_kg_client?: number;
          price_per_kg_supplier?: number;
          minimum?: number;
        };
        surcharges?: { included_surcharges?: Array<Record<string, unknown>> };
      }
    | undefined;
  out._chargeable_weight_n = Number(
    rt.chargeable_weight ?? pricing?.base?.chargeable_weight ?? 0,
  );
  out._actual_weight_n = Number(rt.actual_weight ?? 0);
  out._volumetric_weight_n = Number(rt.volumetric_weight ?? 0);
  out._rate_per_kg_n = Number(
    rt.rate_per_kg ??
      pricing?.base?.price_per_kg_client ??
      pricing?.base?.price_per_kg_supplier ??
      0,
  );
  out._minimum_charge_n = Number(
    rt.minimum_charge ?? pricing?.base?.minimum ?? 0,
  );

  // ---- Route via list (realtime only). Computed from route.jumps minus endpoints. ----
  const via = (raw.route as { via?: string[] | string } | undefined)?.via;
  if (Array.isArray(via)) {
    out._via = via.filter(Boolean) as string[];
  } else if (typeof via === "string" && via) {
    out._via = via.split(/[,\s/]+/).filter(Boolean);
  } else {
    const jumps = raw.route?.jumps ?? [];
    if (jumps.length > 2) out._via = jumps.slice(1, -1);
  }

  // ---- Validity window ----
  out._valid_from = (rt.valid_from as string) ?? raw.departure ?? null;
  out._valid_to =
    (rt.valid_to as string) ?? (raw.valid_until as string) ?? null;

  out._promotional = Boolean(rt.promotional);
  // `product` Y `product_name`: las fuentes no coinciden en el nombre.
  // WebCargo realtime emite `product` (Realtime_Handler:806) y published
  // emite `product_name` (Xml_Rate_Service:303). Leyendo solo el segundo,
  // _product_name quedaba SIEMPRE vacio en realtime — y con el el filtro de
  // producto (matchesFilters) nunca casaba para esas tarifas.
  out._product_name = String(
    (rt as { product?: unknown }).product ?? rt.product_name ?? "",
  );
  out._service_type = String(rt.service_type ?? "");
  out._notes = String(rt.notes ?? "");

  // ---- Bookability + cut-off ----
  out._not_bookable_reason = String(
    (raw as { not_bookable_reason?: unknown }).not_bookable_reason ?? "",
  );
  // `klm_quote` emite `last_acceptance_ts` (el REAL de la aerolinea);
  // `realtime` emite `last_acceptance_datetime` (orientativo). Se leen los dos
  // en un solo campo y la diferencia se conserva en la bandera de al lado, que
  // es lo que permite a la UI no presentar una estimacion como un compromiso.
  const rawCutoff = raw as {
    last_acceptance_ts?: unknown;
    last_acceptance_datetime?: unknown;
    last_acceptance_estimated?: unknown;
  };
  out._last_acceptance = String(
    rawCutoff.last_acceptance_ts ?? rawCutoff.last_acceptance_datetime ?? "",
  );
  out._last_acceptance_estimated = rawCutoff.last_acceptance_estimated === true;

  // ---- Surcharges: unify realtime (flat array) + published (nested) ----
  const flatSurs = rt.surcharges;
  if (Array.isArray(flatSurs)) {
    for (const s of flatSurs as Array<Record<string, unknown>>) {
      const amt = Number(s.amount ?? s.amount_client ?? s.value ?? 0);
      if (!amt && !s.code) continue;
      out._surcharges_n.push({
        code: String(s.code ?? ""),
        name: String(s.name ?? s.label ?? s.description ?? ""),
        amount: amt,
        currency: String(s.currency ?? out._currency),
        type: s.type as string | undefined,
      });
    }
  } else {
    const inc = pricing?.surcharges?.included_surcharges;
    if (Array.isArray(inc)) {
      for (const s of inc) {
        out._surcharges_n.push({
          code: String(s.code ?? ""),
          name: String(s.name ?? s.label ?? ""),
          amount: Number(s.amount_client ?? s.amount ?? 0),
          currency: String(s.currency ?? out._currency),
          type: s.type as string | undefined,
        });
      }
    }
    // Also accept client_price.surcharges.items[] when present.
    const cp = raw.client_price;
    if (cp && typeof cp === "object") {
      const items = (cp as { surcharges?: { items?: NormalizedSurcharge[] } })
        .surcharges?.items;
      if (Array.isArray(items) && !out._surcharges_n.length) {
        for (const it of items) {
          const code = String(it.code ?? "");
          out._surcharges_n.push({
            code,
            // KLM manda el codigo IATA pero no su descripcion, asi que una
            // quote mostraba filas "MU 4,65" sin decir de que. Se traduce lo
            // conocido y se cae al codigo para el resto: preferible un codigo
            // crudo a una fila sin etiqueta.
            name: String(it.name ?? SURCHARGE_LABELS[code] ?? code),
            amount: Number(it.amount ?? 0),
            currency: String(it.currency ?? out._currency),
            type: it.type,
          });
        }
      }
    }
  }

  return out;
}

/** Resolve canonical segment list from the three shapes the backend uses. */
export function segmentsFromRate(r: FlightRate): FlightSegment[] {
  // Los endpoints de DETALLE (`api_cargo_klm_rate_detail`,
  // `api_cargo_webcargo_rate_detail`) devuelven el itinerario anidado dentro de
  // `rate_data`, mientras que los resultados de búsqueda lo traen en la raíz.
  // Es el mismo rate en ambos casos, así que se mira dentro antes de rendirse:
  // sin esto, el detalle de una tarifa YA seleccionada decía "No segment detail
  // available" aunque el vuelo estuviera ahí — KLM en `rate_data.segments` y
  // WebCargo en `rate_data.connection.connectionSegments.segment`.
  const inner = (r as { rate_data?: FlightRate }).rate_data;
  if (inner && typeof inner === "object") {
    const nested = { ...inner, airline_code: inner.airline_code ?? r.airline_code };
    const hasInner =
      (Array.isArray(inner.segments) && inner.segments.length > 0) ||
      (Array.isArray(inner.connection?.connectionSegments?.segment) &&
        inner.connection!.connectionSegments!.segment!.length > 0);
    const hasOuter =
      (Array.isArray(r.segments) && r.segments.length > 0) ||
      (Array.isArray(r.connection?.connectionSegments?.segment) &&
        r.connection!.connectionSegments!.segment!.length > 0);
    if (hasInner && !hasOuter) {
      return segmentsFromRate(nested);
    }
  }
  if (Array.isArray(r.segments) && r.segments.length) {
    return r.segments.map((s) => ({
      carrier: s.carrier ?? r.airline_code,
      flight_number: s.flight_number ?? null,
      origin: s.origin,
      destination: s.destination,
      vehicle: s.vehicle ?? null,
      departure: s.departure ?? null,
      arrival: s.arrival ?? null,
    }));
  }
  const rawSegs = r.connection?.connectionSegments?.segment;
  if (Array.isArray(rawSegs) && rawSegs.length) {
    return rawSegs.map((seg) => {
      const s = seg as Record<string, Record<string, Record<string, unknown>>>;
      return {
        carrier:
          (s.marketingCarrier?.carrierCode?.value as string) ?? r.airline_code,
        flight_number: (s.itineraryNumber?.value as unknown as string) ?? null,
        origin: (s.origin?.locationCode?.value as string) ?? "",
        destination: (s.destination?.locationCode?.value as string) ?? "",
        vehicle: (s.vehicleType?.value as unknown as string) ?? null,
        // Horarios POR TRAMO. Esta rama no los extraia, asi que el detalle de
        // un vuelo con escalas mostraba la ruta pero ninguna hora — aunque el
        // payload si las trae. Viven en `segmentDateTimes` (del segmento), no
        // en `rateDateTimes` (del rate completo): ver Realtime_Handler:714-715.
        departure:
          ((s.segmentDateTimes as Record<string, unknown> | undefined)
            ?.scheduledTimeOfDeparture as string) ?? null,
        arrival:
          ((s.segmentDateTimes as Record<string, unknown> | undefined)
            ?.scheduledTimeOfArrival as string) ?? null,
      };
    });
  }
  const fns = r.flight_numbers ?? [];
  const jumps = r.route?.jumps ?? [];
  const vehicles = r.vehicles ?? [];
  if (fns.length && jumps.length >= fns.length + 1) {
    return fns.map((fn, i) => ({
      carrier: r.airline_code,
      flight_number: fn,
      origin: jumps[i],
      destination: jumps[i + 1],
      vehicle: vehicles[i] ?? null,
    }));
  }
  /* Ultimo recurso: una ruta declarada sin numeros de vuelo. Un rate de
     catalogo no lleva vuelo asignado, pero SI sabe por donde va, y la rama de
     arriba lo descartaba entero por exigir `flight_numbers`. */
  if (jumps.length >= 2) {
    return jumps.slice(0, -1).map((from, i) => ({
      carrier: r.airline_code,
      flight_number: null,
      origin: from,
      destination: jumps[i + 1],
      vehicle: null,
    }));
  }
  return [];
}

/**
 * Origen y destino de la tarifa: primer y ultimo aeropuerto del itinerario.
 *
 * Existe porque el wizard y el detalle leian `rate.origin` / `rate.destination`
 * de la RAIZ del rate, y ahi no estan en NINGUNA fuente — ni WebCargo ni KLM.
 * El resultado era "? → ?" cada vez que el backend no sintetizaba un
 * `route.jumps` de conveniencia (es decir, siempre en WebCargo realtime, cuyo
 * itinerario vive en `connection.connectionSegments.segment[].origin
 * .locationCode.value`, tres niveles mas abajo).
 *
 * Se deriva de `segmentsFromRate`, que ya resuelve las cuatro formas de
 * itinerario del backend, para que una fuente nueva funcione aqui sin tocar
 * este helper. `route.jumps` se consulta primero solo por ser el shape que ya
 * viene resumido.
 *
 * @returns `{ origin, destination }` con "" en lo que no se pueda determinar.
 */
export function routeEndpoints(r: FlightRate): {
  origin: string;
  destination: string;
} {
  const jumps = r.route?.jumps ?? [];
  if (jumps.length >= 2) {
    return { origin: String(jumps[0]), destination: String(jumps[jumps.length - 1]) };
  }

  const segs = segmentsFromRate(r);
  if (segs.length) {
    return {
      origin: String(segs[0].origin ?? ""),
      destination: String(segs[segs.length - 1].destination ?? ""),
    };
  }

  // Algunas fuentes traen los terminales sueltos en la raiz del rate.
  const raw = r as unknown as Record<string, unknown>;
  return {
    origin: String(raw.origin_terminal ?? raw.origin ?? ""),
    destination: String(raw.destination_terminal ?? raw.destination ?? ""),
  };
}

/**
 * Numero(s) de vuelo, ya prefijados con la aerolinea cuando hace falta.
 *
 * El backend los manda de dos formas segun la fuente: "KL672" ya completo, o
 * "672" pelado. Anteponer el codigo IATA solo en el segundo caso evita tanto
 * "672" a secas —que no identifica nada— como "KLKL672".
 *
 * Dos origenes segun el proveedor: WebCargo manda `flight_numbers[]` sueltos y
 * KLM los trae dentro de cada segmento. Leer solo uno dejaba media tabla sin
 * numero de vuelo. `segmentsFromRate` ya unifica las formas de segmento.
 *
 * Del segmento se toma tambien SU carrier: un tramo puede ir operado por otra
 * aerolinea (AF vendiendo un tramo KL), y prefijar todo con el codigo de la
 * fila mentiria sobre quien vuela ese tramo.
 *
 * Vacio para tarifas de catalogo: no tienen vuelo asignado, y en ese caso quien
 * pinta decide si omite la linea o muestra otra cosa.
 *
 * Vive aqui, y no en cada vista, porque la tabla de resultados y el dialogo de
 * similares mostraban el MISMO vuelo con dos copias literales de esta funcion.
 *
 * @param max Cuantos numeros como maximo (por defecto 3).
 */
export function flightLabelOf(r: FlightRate, max = 3): string {
  const code = (r.airline_code || "").toUpperCase();

  const fromSegments = segmentsFromRate(r)
    .map((s) => ({
      num: String(s.flight_number ?? "").trim(),
      carrier:
        String(s.carrier ?? "")
          .trim()
          .toUpperCase() || code,
    }))
    .filter((s) => s.num);
  const fromFlat = (Array.isArray(r.flight_numbers) ? r.flight_numbers : [])
    .map((n) => ({ num: String(n ?? "").trim(), carrier: code }))
    .filter((s) => s.num);

  const nums = fromSegments.length ? fromSegments : fromFlat;

  return nums
    .map((s) =>
      /^[A-Z]{2}/i.test(s.num) ? s.num.toUpperCase() : `${s.carrier}${s.num}`,
    )
    .slice(0, max)
    .join(" · ");
}

/**
 * Fecha+hora corta para una fila de vuelo: "07/08 14:30".
 *
 * Devuelve el ISO tal cual si no se puede parsear —mejor un dato feo que
 * perderlo— y `emptyValue` cuando no hay nada.
 */
export function formatFlightDateTime(iso: string, emptyValue = "—"): string {
  if (!iso) return emptyValue;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

/** Solo la fecha: "07/08". */
export function formatFlightDate(iso: string, emptyValue = "—"): string {
  if (!iso) return emptyValue;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/**
 * Locale de agrupacion por moneda.
 *
 * En cargo NO todo es EUR: hay ~478 envios en USD y ademas INR, GBP, CHF, RUB,
 * JOD, TWD y CNY. Formatear un importe en dolares con separadores italianos
 * ("USD 1.234,56") es ambiguo de verdad, no solo feo: en en-US el punto ES el
 * decimal, asi que ese mismo texto se lee como "uno coma dos" o como "mil
 * doscientos" segun quien mire. Con dinero eso no se puede dejar al azar.
 *
 * Se mapea cada moneda al locale que dicta SU convencion. Lo que no este aqui
 * cae al italiano, que es el idioma de trabajo del operador.
 */
const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  GBP: "en-GB",
  INR: "en-IN", // agrupacion india (1,23,456), no la de miles occidental
  CHF: "de-CH",
  CNY: "zh-CN",
  TWD: "zh-TW",
  JPY: "ja-JP",
  RUB: "ru-RU",
  PLN: "pl-PL",
};

/**
 * Importe de una tarifa: "EUR 12.345,67", "USD 12,345.67".
 *
 * Todas las vistas de vuelos escribian `${cur} ${n.toFixed(2)}` a mano, en 16
 * sitios, asi que una tarifa de cinco cifras salia como "EUR 12345.67": sin
 * separador de miles cuesta leer el orden de magnitud justo en la columna
 * sobre la que se decide.
 *
 * NO se usa `formatMoneyIT` de platform/utils a proposito, por dos razones:
 * antepone el simbolo ("€ 12.345,67") cuando aqui el codigo ISO va DELANTE en
 * las cuatro pantallas, y ademas fuerza la convencion italiana a cualquier
 * moneda. El propio format.ts avisa de no unificar a ciegas.
 *
 * El codigo se mantiene en ISO y no como simbolo: en cargo conviven varias
 * monedas y "€" junto a "$" se confunde de un vistazo mas que las siglas.
 */
export function formatRateAmount(
  amount: number | string | null | undefined,
  currency?: string | null,
): string {
  const cur = String(currency ?? "").trim().toUpperCase() || "EUR";
  return `${cur} ${formatRateNumber(amount, cur)}`;
}

/**
 * Solo el numero, con la agrupacion que dicta la moneda: "12.345,67".
 *
 * Para las lineas que van DEBAJO de un importe que ya nombra la moneda (el
 * coste bajo el precio de venta, por ejemplo): repetir "EUR" en cada linea es
 * ruido, pero los separadores deben seguir siendo los de esa moneda.
 */
export function formatRateNumber(
  amount: number | string | null | undefined,
  currency?: string | null,
): string {
  const n = Number(amount ?? 0);
  const value = Number.isFinite(n) ? n : 0;
  const cur = String(currency ?? "").trim().toUpperCase() || "EUR";
  const locale = CURRENCY_LOCALE[cur] ?? "it-IT";

  // `Intl` puede lanzar con un locale/moneda raros; el importe debe salir
  // igualmente, aunque sea sin agrupar.
  try {
    return value.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return value.toFixed(2);
  }
}

/** Transito en horas decimales → "14h 30'". */
export function formatTransitHours(
  hours: number | null | undefined,
  emptyValue = "—",
): string {
  if (!hours) return emptyValue;
  const h = Math.floor(Number(hours));
  const m = Math.round((Number(hours) - h) * 60);
  return `${h}h${m ? ` ${String(m).padStart(2, "0")}'` : ""}`;
}

/**
 * Persist a selected rate as leg #N. The cargo can hold up to 5 legs;
 * the search dialog defaults to leg 1 (legacy behaviour).
 */
export interface PersistFlightInput {
  shipment_id: number;
  leg: 1 | 2 | 3 | 4 | 5;
  flight_num: string;
  flight_data: string;
  flight_airp: string;
  flight_datad: string;
  flight_aird: string;
}

export interface PersistResult {
  success: boolean;
  error?: string;
}

export async function persistFlightLeg(
  input: PersistFlightInput,
): Promise<PersistResult> {
  const patch: Record<string, string> = {
    id: String(input.shipment_id),
    [`flight_num${input.leg}`]: input.flight_num,
    [`flight_data${input.leg}`]: input.flight_data,
    [`flight_airp${input.leg}`]: input.flight_airp,
    [`flight_datad${input.leg}`]: input.flight_datad,
    [`flight_aird${input.leg}`]: input.flight_aird,
  };
  try {
    const r = await fetch("/bff/v1/unified_cargo_shipment", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: patch }),
    });
    if (!r.ok) return { success: false, error: `HTTP ${r.status}` };
    const j = (await r.json()) as PersistResult;
    return j;
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}


// ─── Filtrado de resultados ─────────────────────────────────────────────────

/**
 * Criterios de filtrado del listado de resultados.
 *
 * Vive aqui y no en el SFC de los filtros porque lo consumen tres sitios (el
 * composable, el panel de filtros y el listado); tenerlo en un componente
 * obligaba al composable a importar de un `.vue`.
 */
export interface FlightFiltersModel {
  carriers: string[];
  /** Legacy per-feed filter; kept so existing callers/URLs keep working. */
  sources: FlightRateSource[];
  /** Carrier system: klm | webcargo | express. */
  providers: FlightRateProvider[];
  /** How it can be bought: direct_booking | published. */
  kinds: FlightRateKind[];
  directOnly: boolean;
  maxStops: number | null;
  priceRange: [number, number] | null;
  maxTransitHours: number | null;
  promotionalOnly: boolean;
  validNow: boolean;
  products: string[];
  serviceTypes: string[];
}

/** Modelo vacio (sin ningun filtro aplicado). */
export function emptyFilters(): FlightFiltersModel {
  return {
    carriers: [],
    sources: [],
    providers: [],
    kinds: [],
    directOnly: false,
    maxStops: null,
    priceRange: null,
    maxTransitHours: null,
    promotionalOnly: false,
    validNow: false,
    products: [],
    serviceTypes: [],
  };
}

/**
 * Horas de tránsito de una tarifa.
 *
 * El proveedor manda `duration_hours`; `transit_hours` NO llega nunca — se
 * comprobó sobre 85 tarifas realtime reales: 0 de 85 lo traían. El filtro de
 * tránsito y el resumen "más rápido" leían solo ese campo, así que llevaban
 * tiempo sin funcionar sin que nada lo delatara.
 *
 * Se aceptan los dos por si alguna fuente sí manda `transit_hours`.
 */
export function transitHoursOf(r: NormalizedRate): number {
  const raw =
    (r as { duration_hours?: number }).duration_hours ?? r.transit_hours ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Categorías de recomendación que la UI puede destacar. */
export type FlightPickKind =
  | "best"
  | "cheapest"
  | "fastest"
  | "fewest_stops"
  | "priority";

export interface FlightPick {
  kind: FlightPickKind;
  rate: NormalizedRate;
  /** Por qué se eligió, en datos — la UI decide cómo redactarlo. */
  reason: { price: number; hours: number; stops: number };
}

/** Precio de cliente ya normalizado; 0 cuando la tarifa no lo trae. */
function priceOf(r: NormalizedRate): number {
  const n = Number(r._client_price_n ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Normaliza a 0..1 dentro del conjunto (0 = mejor).
 *
 * Min-max y no un valor absoluto: 36 h es excelente en un AMS→IAH y pésimo en
 * un intraeuropeo. Lo que importa es la posición dentro de lo que HAY.
 */
function norm(v: number, min: number, max: number): number {
  if (!Number.isFinite(v) || max <= min) return 0;
  return (v - min) / (max - min);
}

/**
 * Los vuelos que merece la pena destacar, sobre las tarifas ya filtradas.
 *
 * SOLO tarifas reservables (`isDirectBooking` + precio real). KLM devuelve
 * opciones NOT_BOOKABLE con precio 0,00 —6 de 52 en una respuesta real— que
 * ganarían "el más barato" sin ser comprables.
 *
 * PESOS: precio 0.5, tiempo 0.35, escalas 0.15. Calibrados sobre una búsqueda
 * real (85 tarifas AMS→IAH: 4.706–7.069 €, 36–105 h, 1–2 escalas), no
 * inventados. El precio domina porque es el criterio que decide la mayoría de
 * las veces; el tiempo pesa casi tanto porque en aéreo un envío que tarda el
 * triple no es la misma mercancía; las escalas quedan de desempate, ya que su
 * efecto real ya viene incorporado en la duración.
 *
 * Una tarifa puede aparecer en varias categorías: que la más barata sea además
 * la más rápida es información, no un problema — la UI lo muestra junto.
 */
export function pickFlights(rates: NormalizedRate[]): FlightPick[] {
  const usable = rates.filter(
    (r) => isDirectBooking(r.source) && !r.price_incomplete && priceOf(r) > 0,
  );
  if (!usable.length) return [];

  const prices = usable.map(priceOf);
  const hours = usable.map(transitHoursOf).filter((h) => h > 0);
  const stops = usable.map((r) => Number(r.stopovers ?? 0));

  const pMin = Math.min(...prices), pMax = Math.max(...prices);
  const hMin = hours.length ? Math.min(...hours) : 0;
  const hMax = hours.length ? Math.max(...hours) : 0;
  const sMin = Math.min(...stops), sMax = Math.max(...stops);

  const score = (r: NormalizedRate): number =>
    0.5 * norm(priceOf(r), pMin, pMax) +
    0.35 * norm(transitHoursOf(r), hMin, hMax) +
    0.15 * norm(Number(r.stopovers ?? 0), sMin, sMax);

  const reason = (r: NormalizedRate) => ({
    price: priceOf(r),
    hours: transitHoursOf(r),
    stops: Number(r.stopovers ?? 0),
  });

  const best = [...usable].sort((a, b) => score(a) - score(b))[0];
  const cheapest = [...usable].sort((a, b) => priceOf(a) - priceOf(b))[0];

  // Sin duración conocida no hay "más rápido" que ofrecer: mejor omitir la
  // categoría que presentar una cualquiera como si lo fuera.
  const timed = usable.filter((r) => transitHoursOf(r) > 0);
  const fastest = timed.length
    ? [...timed].sort((a, b) => transitHoursOf(a) - transitHoursOf(b))[0]
    : null;

  // Desempate por precio: entre dos con las mismas escalas, la barata.
  const fewest = [...usable].sort((a, b) => {
    const d = Number(a.stopovers ?? 0) - Number(b.stopovers ?? 0);
    return d !== 0 ? d : priceOf(a) - priceOf(b);
  })[0];

  // `priority` viene del proveedor (shipmentPriorityCode = Express): 33 de 85
  // en la búsqueda real, así que es una señal viva, no teórica.
  const prio = usable
    .filter((r) => (r as { priority?: boolean }).priority)
    .sort((a, b) => score(a) - score(b))[0];

  const out: FlightPick[] = [
    { kind: "best" as const, rate: best },
    { kind: "cheapest" as const, rate: cheapest },
    ...(fastest ? [{ kind: "fastest" as const, rate: fastest }] : []),
    { kind: "fewest_stops" as const, rate: fewest },
    ...(prio ? [{ kind: "priority" as const, rate: prio }] : []),
  ].map((p) => ({ ...p, reason: reason(p.rate) }));

  return out;
}

/**
 * Predicado unico de filtrado.
 *
 * Habia dos copias — la del composable (que filtraba el listado) y la del panel
 * (que solo calculaba el contador "x de y") — y habian divergido: la segunda
 * ignoraba `providers` y `kinds`, asi que filtrar por proveedor reducia la
 * tabla pero el contador seguia anunciando el total antiguo.
 */
export function matchesFilters(
  r: NormalizedRate,
  f: FlightFiltersModel,
  today: Date,
): boolean {
  if (f.carriers.length && !f.carriers.includes(r.airline_code)) return false;
  if (f.sources.length && !f.sources.includes(r.source)) return false;
  // Provider (who) and kind (how) are derived from `source`, so the operator
  // filters by what they care about instead of by feed name.
  if (f.providers?.length && !f.providers.includes(providerOf(r.source))) {
    return false;
  }
  if (f.kinds?.length && !f.kinds.includes(kindOf(r.source))) return false;
  if (f.directOnly && !r.direct_flight) return false;
  if (f.maxStops !== null && Number(r.stopovers ?? 0) > f.maxStops) return false;
  if (f.priceRange) {
    const p = r._client_price_n;
    if (p < f.priceRange[0] || p > f.priceRange[1]) return false;
  }
  if (f.maxTransitHours !== null) {
    const t = transitHoursOf(r);
    if (t && t > f.maxTransitHours) return false;
  }
  if (f.promotionalOnly && !r._promotional) return false;
  if (f.validNow) {
    if (r._valid_to) {
      const exp = new Date(r._valid_to);
      if (!Number.isNaN(exp.getTime()) && exp < today) return false;
    }
    if (r._valid_from) {
      const start = new Date(r._valid_from);
      if (!Number.isNaN(start.getTime()) && start > today) return false;
    }
  }
  if (f.products.length && !f.products.includes(r._product_name)) return false;
  if (f.serviceTypes.length && !f.serviceTypes.includes(r._service_type)) {
    return false;
  }
  return true;
}

/** Medianoche de hoy — frontera para `validNow`. */
export function filterToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ═══════════════════════════════════════════════════════════════════════
   RECOMENDACION — portado del B2B (/var/www/host/tmwe/js/airbooking_app.js)
   ═══════════════════════════════════════════════════════════════════════

   NO son pesos fijos: es distancia euclidea a un vuelo IDEAL construido con el
   mejor valor de cada eje DENTRO del propio conjunto de resultados. Esa es su
   virtud frente a unos pesos arbitrarios — se autoescala a cada busqueda: si
   todos los vuelos cuestan parecido, el precio deja de decidir solo y pesan
   mas las escalas y la hora de llegada.

   Ejes del B2B (`improve_ideal_flight`, :285-294):
     · total      -> precio cliente     (menor mejor)
     · stopovers  -> numero de escalas  (menor mejor)
     · arrival    -> hora de llegada    (antes mejor)

   Se anade `transit` (duracion), que el B2B no tenia porque alli el vuelo era
   siempre del mismo dia; aqui hay rutas con escalas de mas de 24h.
*/

/** Vector de ejes: mejor valor del conjunto (`ideal`) y mayor (`max`) para escalar. */
interface IdealAxes {
  ideal: Record<string, number>;
  max: Record<string, number>;
}

/** Ejes numericos de una tarifa. Un eje ausente o no numerico se omite. */
function axesOf(r: NormalizedRate): Record<string, number> {
  const out: Record<string, number> = {};

  const price = Number(r._client_price_n);
  if (Number.isFinite(price) && price > 0) out.total = price;

  const stops = Number(r.stopovers ?? 0);
  if (Number.isFinite(stops)) out.stopovers = stops;

  const transit = transitHoursOf(r);
  if (transit > 0) out.transit = transit;

  // La llegada se compara como timestamp: "antes" es "menor".
  const arr = r.arrival ? Date.parse(String(r.arrival)) : NaN;
  if (Number.isFinite(arr)) out.arrival = arr;

  return out;
}

/**
 * Vuelo ideal del conjunto: el mejor valor de cada eje, mas el mayor para
 * normalizar. Equivale a `improve_ideal_flight` del B2B.
 */
function buildIdeal(rates: NormalizedRate[]): IdealAxes {
  const acc: IdealAxes = { ideal: {}, max: {} };
  for (const r of rates) {
    const ax = axesOf(r);
    for (const k of Object.keys(ax)) {
      const v = ax[k];
      acc.ideal[k] = acc.ideal[k] === undefined ? v : Math.min(acc.ideal[k], v);
      acc.max[k] = acc.max[k] === undefined ? v : Math.max(acc.max[k], v);
    }
  }
  return acc;
}

/**
 * Distancia euclidea al ideal con cada eje normalizado contra su maximo
 * (`normalize_vector` + `calculate_from_ideal_sqr_distance` del B2B).
 *
 * Solo cuentan los ejes presentes en AMBOS: una tarifa sin hora de llegada no
 * se penaliza por no tenerla, se compara por lo que si trae.
 */
function distanceToIdeal(r: NormalizedRate, ideal: IdealAxes): number {
  const ax = axesOf(r);
  let sum = 0;
  for (const k of Object.keys(ideal.ideal)) {
    const max = ideal.max[k];
    if (!Number.isFinite(max) || max === 0) continue;
    if (ax[k] === undefined) continue;
    const d = ax[k] / max - ideal.ideal[k] / max;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Ordena por "recomendado": menor distancia al ideal primero.
 *
 * Devuelve un array NUEVO y no muta la entrada. La identidad de cada fila
 * (`_rowKey`) queda intacta — reordenar nunca debe cambiarla, o Vue recrearia
 * las filas y el boton Select se desmontaria a mitad del clic.
 */
export function rankRecommended(rates: NormalizedRate[]): NormalizedRate[] {
  if (rates.length < 2) return rates.slice();
  const ideal = buildIdeal(rates);
  return rates
    .map((r) => ({ r, d: distanceToIdeal(r, ideal) }))
    .sort((a, b) => a.d - b.d)
    .map((s) => s.r);
}

/** Modos de orden: los del B2B mas `transit` y `stops`. */
export type FlightSortBy =
  | "recommended"
  | "price"
  | "arrival"
  | "transit"
  | "stops";

/** Aplica un orden. `recommended` delega en rankRecommended. */
export function sortRates(
  rates: NormalizedRate[],
  by: FlightSortBy,
): NormalizedRate[] {
  if (by === "recommended") return rankRecommended(rates);
  const out = rates.slice();
  switch (by) {
    case "price":
      out.sort((a, b) => (a._client_price_n ?? 0) - (b._client_price_n ?? 0));
      break;
    case "arrival":
      out.sort((a, b) => {
        const av = a.arrival ? Date.parse(String(a.arrival)) : Infinity;
        const bv = b.arrival ? Date.parse(String(b.arrival)) : Infinity;
        return av - bv;
      });
      break;
    case "transit":
      out.sort(
        (a, b) =>
          (transitHoursOf(a) || Infinity) - (transitHoursOf(b) || Infinity),
      );
      break;
    case "stops":
      out.sort((a, b) => Number(a.stopovers ?? 0) - Number(b.stopovers ?? 0));
      break;
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   AGRUPACION POR SIMILITUD
   ═══════════════════════════════════════════════════════════════════════

   No tiene sentido gastar una pagina entera del listado en la misma aerolinea
   cuando esos vuelos son practicamente el mismo producto comercial. El B2B ya
   lo resuelve (airbooking_app.js:383-481) agrupando por
   `[total][arrival_timestamp_am_pm]`. Aqui hay DOS diferencias deliberadas:

   1. LA AEROLINEA ENTRA SIEMPRE EN LA CLAVE, y es innegociable.
      En el B2B esta implicita porque los datos ya vienen segmentados por
      compania (`data[airline_code][date]`); aqui la tabla MEZCLA fuentes y
      transportistas, asi que copiar su clave tal cual agruparia vuelos de
      companias distintas.
      Ademas el transportista es un criterio de decision propio del operador
      —acuerdos, franquicias, fiabilidad, restricciones de mercancia—, no un
      atributo promediable: esconder un vuelo de AF dentro de un grupo de IB le
      ocultaria una alternativa que necesita ver.

   2. El representante es el mas cercano al CENTROIDE del grupo, no el primero
      en llegar como hace el B2B (`flag = false` en la primera insercion). Asi
      no cambia porque el SSE entregue las tarifas en otro orden.
*/

/** Tolerancia de precio dentro de un grupo. Un solo sitio donde ajustarla. */
export const SIMILARITY_PRICE_TOLERANCE = 0.05; // ±5 %

export interface RateGroup {
  /** El vuelo que se pinta: el mas cercano al centroide. */
  leader: NormalizedRate;
  /** Los demas del grupo, plegados. Vacio cuando el grupo es de uno. */
  members: NormalizedRate[];
}

/** Franja de llegada en bloques de 6h — equivalente al am/pm del B2B. */
function arrivalBucket(r: NormalizedRate): string {
  const t = r.arrival ? Date.parse(String(r.arrival)) : NaN;
  if (!Number.isFinite(t)) return "na";
  const d = new Date(t);
  return [
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    Math.floor(d.getUTCHours() / 6),
  ].join("-");
}

/**
 * Clave de grupo. Aerolinea y escalas son EXACTAS; el precio entra por bandas
 * logaritmicas, de modo que dos precios dentro del ±5% caen en la misma.
 */
function groupKeyOf(r: NormalizedRate): string {
  const airline = (r.airline_code || "??").toUpperCase();
  const stops = Number(r.stopovers ?? 0);
  const price = Number(r._client_price_n) || 0;
  const band =
    price > 0
      ? Math.round(Math.log(price) / Math.log(1 + SIMILARITY_PRICE_TOLERANCE))
      : 0;
  return `${airline}|${stops}|${band}|${arrivalBucket(r)}`;
}

/**
 * Agrupa vuelos "practicamente iguales". Cada grupo pinta su lider y ofrece
 * desplegar los demas.
 *
 * El orden de los grupos respeta el del array de entrada (por su lider), asi
 * que agrupar DESPUES de ordenar conserva el ranking.
 *
 * `_rowKey` no se toca: el grupo es una VISTA, no una identidad nueva. Es lo
 * que permite reagrupar sin que Vue recree las filas.
 */
export function groupBySimilarity(rates: NormalizedRate[]): RateGroup[] {
  const buckets = new Map<string, NormalizedRate[]>();
  const order: string[] = [];

  for (const r of rates) {
    const k = groupKeyOf(r);
    let bucket = buckets.get(k);
    if (!bucket) {
      bucket = [];
      buckets.set(k, bucket);
      order.push(k);
    }
    bucket.push(r);
  }

  return order.map((k) => {
    const items = buckets.get(k) as NormalizedRate[];
    if (items.length === 1) return { leader: items[0], members: [] };

    // Centroide: media de cada eje. Se reutiliza el mismo instrumental que la
    // recomendacion (buildIdeal para las escalas, distanceToIdeal para medir),
    // asi que no hay una segunda formula que mantener.
    const scale = buildIdeal(items);
    const centroid: IdealAxes = { ideal: {}, max: scale.max };
    for (const axis of Object.keys(scale.max)) {
      let sum = 0;
      let n = 0;
      for (const it of items) {
        const v = axesOf(it)[axis];
        if (v !== undefined) {
          sum += v;
          n += 1;
        }
      }
      if (n > 0) centroid.ideal[axis] = sum / n;
    }

    let leader = items[0];
    let best = Infinity;
    for (const it of items) {
      const d = distanceToIdeal(it, centroid);
      if (d < best) {
        best = d;
        leader = it;
      }
    }
    return { leader, members: items.filter((x) => x !== leader) };
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   PESTANAS POR FUENTE
   ═══════════════════════════════════════════════════════════════════════

   Con las cuatro fuentes marcadas quedan cinco pestanas:

     Consigliati · KLM/AF realtime · WebCargo realtime · Rates KLM/AF · Rates WebCargo

   "Consigliati" mezcla los DIRECT BOOKING de ambos proveedores —los que se
   pueden reservar de verdad— ordenados por rankRecommended. Solo aparece si
   hay al menos dos: con uno no hay nada que recomendar.

   Las pestanas se derivan de las fuentes PEDIDAS, no de una lista fija, de
   modo que no aparecen pestanas de fuentes que el operador no marco. Y una
   pestana pedida que devuelve cero NO se oculta: se muestra deshabilitada con
   su cero, porque "WebCargo no encontro nada" es informacion — ocultarla haria
   pensar que ni siquiera se consulto.

   `express` queda fuera a proposito: es courier, no carga aerea.
*/

export interface FlightTab {
  key: string;
  /** Clave i18n del rotulo. */
  labelKey: string;
  count: number;
  disabled: boolean;
  /** Filtro que aplica esta pestana al conjunto. */
  match: (r: NormalizedRate) => boolean;
}

/** Fuentes aereas, en el orden en que se muestran. */
const AIR_TAB_DEFS: Array<{
  key: string;
  labelKey: string;
  source: FlightRateSource;
}> = [
  {
    key: "klm_realtime",
    labelKey: "cargo.flight.tab_klm_realtime",
    source: "klm_quote",
  },
  {
    key: "wc_realtime",
    labelKey: "cargo.flight.tab_wc_realtime",
    source: "realtime",
  },
  { key: "klm_rates", labelKey: "cargo.flight.tab_klm_rates", source: "klm" },
  {
    key: "wc_rates",
    labelKey: "cargo.flight.tab_wc_rates",
    source: "published",
  },
];

/**
 * Construye las pestanas del conjunto actual.
 *
 * @param rates    tarifas ya recibidas
 * @param requested fuentes que el operador pidio. Si se omite, se deducen de
 *                  los resultados: util mientras el SSE aun esta llegando.
 *
 * Devuelve [] cuando solo hay una fuente en juego: una sola pestana no aporta
 * nada, solo ocupa sitio.
 */
export function buildTabs(
  rates: NormalizedRate[],
  requested?: FlightRateSource[],
): FlightTab[] {
  const asked = requested?.length
    ? new Set(requested)
    : new Set(rates.map((r) => r.source));

  const present = AIR_TAB_DEFS.filter((d) => asked.has(d.source)).map((d) => ({
    ...d,
    count: rates.filter((r) => r.source === d.source).length,
  }));

  if (present.length <= 1) return [];

  const tabs: FlightTab[] = [];

  const recommended = rates.filter((r) => isDirectBooking(r.source));
  if (recommended.length >= 2) {
    tabs.push({
      key: "recommended",
      labelKey: "cargo.flight.tab_recommended",
      count: recommended.length,
      disabled: false,
      match: (r) => isDirectBooking(r.source),
    });
  }

  for (const d of present) {
    tabs.push({
      key: d.key,
      labelKey: d.labelKey,
      count: d.count,
      disabled: d.count === 0,
      match: (r) => r.source === d.source,
    });
  }
  return tabs;
}

/**
 * Aplica una pestana y su orden.
 *
 * `recommended` fuerza el ranking —es lo que la define—; el resto respeta el
 * `sortBy` que haya elegido el operador.
 */
export function ratesForTab(
  rates: NormalizedRate[],
  tab: FlightTab | null,
  sortBy: FlightSortBy = "recommended",
): NormalizedRate[] {
  const subset = tab ? rates.filter(tab.match) : rates;
  return sortRates(subset, tab?.key === "recommended" ? "recommended" : sortBy);
}
