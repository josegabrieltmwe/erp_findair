import { http } from "./http";
import type {
  Cargo,
  CargoCrudResponse,
  CargoChargeDetail,
  CargoPackage,
} from "./cargo.types";

export interface LoadCargoOptions {
  /** future: relations (packages/charges/awb...) controlled by the unified endpoint */
}

export const cargoService = {
  /** unified_cargo_shipment GET — full payload of a cargo shipment. */
  load(id: number, _opts: LoadCargoOptions = {}): Promise<CargoCrudResponse> {
    return http<CargoCrudResponse>("/unified_cargo_shipment", {
      query: { id },
    });
  },

  /** unified_cargo_shipment PATCH — partial update. */
  update(id: number, patch: Partial<Cargo>): Promise<CargoCrudResponse> {
    return http<CargoCrudResponse>("/unified_cargo_shipment", {
      method: "PATCH",
      query: { id },
      // id also in body as a fallback: the backend resolves it from $_GET first,
      // but a lost query string would otherwise leave the request with no id.
      body: { id, ...patch },
    });
  },

  /**
   * api_cargo_handler_assign POST — copy the carrier's default handler+sede
   * onto the cargo (legacy "Copia handler dal vettore"). Persists server-side;
   * returns the resolved handler id/sede + available sedi + note.
   */
  assignHandlerFromVettore(id: number): Promise<{
    success: boolean;
    data?: {
      handler_id: number;
      handler_id_sede: number;
      sedi: HandlerSede[];
      note: string;
    };
    error?: string;
  }> {
    return http("/api_cargo_handler_assign", {
      method: "POST",
      body: { cargo_id: id },
    });
  },

  /**
   * List the sedi of a given handler (legacy cargovett_handl_sedi_ajax.php).
   * Returns a flat array of {id, nome_sede}. Used to populate the sede select
   * when the operator changes the handler id.
   */
  async listHandlerSedi(id_handler: number): Promise<HandlerSede[]> {
    if (!id_handler) return [];
    const rows = await http<HandlerSedeRow[]>("/api_cargo_handler_addresses", {
      query: { id_handler },
    });
    return (rows ?? []).map((r) => ({
      id: Number(r.id),
      nome_sede: r.nome_sede,
    }));
  },

  /**
   * List the handlers for a cargo (legacy spedyc_array.php `handler_id` select).
   * The session wrapper resolves the partner by the cargo's departure terminal
   * (webcargo_key, IT fallback) — paridad con "copiar del vettore". Returns a
   * flat array of {id, nome} to feed the handler select.
   */
  async listHandlers(cargo_id: number): Promise<HandlerOption[]> {
    if (!cargo_id) return [];
    const rows = await http<HandlerRow[]>("/api_cargo_handlers_web", {
      query: { cargo_id },
    });
    return (rows ?? []).map((r) => ({ id: Number(r.id), nome: r.nome }));
  },
};

/** One assignable owner user (partner-scoped). */
export interface OwnerOption {
  id: number;
  name: string;
  email: string;
  login: string;
}

/**
 * Owner reassignment — lists the users (contatti) of the cargo's owning
 * partner that can be set as `owner_user`. Hybrid-auth web wrapper of
 * api_cargo_owner_options. The actual write goes through the normal cargo
 * PATCH ({ owner_user }), audited server-side via Log_Modifiche.
 */
export const ownerService = {
  async options(
    cargo_id: number,
  ): Promise<{ options: OwnerOption[]; current_owner: number }> {
    const res = await http<{
      success: boolean;
      data?: { options: OwnerOption[]; current_owner: number };
    }>("/api_cargo_owner_options", { query: { cargo_id } });
    return {
      options: res?.data?.options ?? [],
      current_owner: Number(res?.data?.current_owner ?? 0),
    };
  },
};

/** A handler location (handlers_sedi). */
export interface HandlerSede {
  id: number;
  nome_sede: string;
}

/** Raw row shape returned by api_cargo_handler_addresses (mysqli strings). */
interface HandlerSedeRow {
  id: number | string;
  nome_sede: string;
}

/** One handler option for the select (legacy `handler_id` dropdown). */
export interface HandlerOption {
  id: number;
  nome: string;
}

/** Raw row shape returned by api_cargo_handlers_web (mysqli strings). */
interface HandlerRow {
  id: number | string;
  nome: string;
}

// ────────────────────────────────────────────────────────────
// Charge detail lines (spedizioni_cargo_dett)
// Route: api_cargo_charge_details (PATCH update, DELETE delete, POST add/recalculate)
// ────────────────────────────────────────────────────────────

export const chargeDetailsService = {
  list(
    cargo_id: number,
  ): Promise<{ success: boolean; data?: CargoChargeDetail[]; error?: string }> {
    return http("/api_cargo_charge_details", { query: { cargo_id } });
  },
  add(
    cargo_id: number,
    row: Partial<CargoChargeDetail>,
  ): Promise<{ success: boolean; data?: { id: number }; error?: string }> {
    return http("/api_cargo_charge_details", {
      method: "POST",
      body: { action: "add", cargo_id, row },
    });
  },
  update(
    id: number,
    field: keyof CargoChargeDetail,
    value: unknown,
    cargo_id?: number,
  ): Promise<{ success: boolean; error?: string }> {
    // cargo_id es obligatorio en el backend para el guard IDOR (autoriza la
    // edición sobre un cargo accesible). Sin él → 400 "cargo_id is required".
    return http("/api_cargo_charge_details", {
      method: "PATCH",
      body: { action: "update", id, field, value, cargo_id },
    });
  },
  recalculate(
    cargo_id: number,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return http("/api_cargo_charge_details", {
      method: "POST",
      body: { action: "recalculate", cargo_id },
    });
  },
  remove(id: number): Promise<{ success: boolean; error?: string }> {
    return http("/api_cargo_charge_details", {
      method: "DELETE",
      body: { action: "delete", id },
    });
  },
};

// ────────────────────────────────────────────────────────────
// Packages (spedizioni_colli with id_cargo set)
// Route: api_cargo_packages (PATCH update, DELETE delete, POST add/bulk)
// ────────────────────────────────────────────────────────────

export interface CargoPackagesPayload {
  shipment_id: number;
  shipment_type: "cargo";
  packages: CargoPackage[];
  totals: { count: number; total_weight: number; total_volume: number };
  count: number;
}

export const packagesService = {
  list(shipment_id: number): Promise<{
    success: boolean;
    data?: CargoPackagesPayload;
    error?: string;
  }> {
    return http("/api_cargo_packages", { query: { shipment_id } });
  },
  add(
    shipment_id: number,
    pkg: Partial<CargoPackage>,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return http("/api_cargo_packages", {
      method: "POST",
      body: { action: "add", shipment_id, ...pkg },
    });
  },
  addBulk(
    shipment_id: number,
    packages: Partial<CargoPackage>[],
  ): Promise<{ success: boolean; error?: string }> {
    return http("/api_cargo_packages", {
      method: "POST",
      body: { action: "bulk", shipment_id, packages },
    });
  },
  update(
    package_id: number,
    fields: Partial<CargoPackage>,
  ): Promise<{ success: boolean; error?: string }> {
    return http("/api_cargo_packages", {
      method: "PATCH",
      body: { action: "patch", package_id, ...fields },
    });
  },
  remove(package_id: number): Promise<{ success: boolean; error?: string }> {
    return http("/api_cargo_packages", {
      method: "DELETE",
      body: { action: "delete", package_id },
    });
  },
};

// ────────────────────────────────────────────────────────────
// Cargo addresses (spedizioni_indirizzi with id_spedizione = cargo id)
// Route: api_cargo_addresses_compat
//   tipo='D' destination, 'P' pickup, 'A' customs agency, 'H' handler
// ────────────────────────────────────────────────────────────

export type CargoAddressTipo = "D" | "P" | "A" | "H";

export interface CargoAddress {
  id: number | string;
  id_spedizione: number | string;
  tipo: CargoAddressTipo;
  nome: string | null;
  adress: string | null;
  cap: string | null;
  citta: string | null;
  prov: string | null;
  id_paese_iso: string | null;
  attenzione: string | null;
  tel: string | null;
  cell?: string | null;
  mail: string | null;
  dhl_airport: string | null;
}

/**
 * Sede interna del cliente (sedi_interne). Cuando el cargo no tiene dirección
 * de presa propia, el origen es esta sede.
 */
export interface CargoSede {
  id: number | string;
  label: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  prov: string | null;
  id_paese_iso: string | null;
  mail: string | null;
  /** Datos de recogida que el legacy muestra junto a la dirección. */
  presa_fissa: string | null;
  presa_ora: string | null;
  presa_limite: string | null;
}

export interface CargoAddressesPayload {
  cargo_id: number;
  destination: CargoAddress | null;
  pickup: CargoAddress | null;
  agency: CargoAddress | null;
  handler: CargoAddress | null;
  /**
   * true cuando NO hay fila de presa activa: el origen se hereda de la sede.
   * Cargo no tiene la columna `presa_tipo` de express; la ausencia de la fila
   * ES el interruptor (paridad spedyc_form.php:74).
   */
  uses_sede_address: boolean;
  sede: CargoSede | null;
}

export const cargoAddressesService = {
  list(cargo_id: number): Promise<{
    success: boolean;
    data?: CargoAddressesPayload;
    error?: string;
  }> {
    return http("/api_cargo_addresses_compat", { query: { cargo_id } });
  },
  /** Create OR update by tipo (the controller archives the previous active row of the same tipo). */
  upsert(
    cargo_id: number,
    tipo: CargoAddressTipo,
    fields: Partial<CargoAddress>,
  ): Promise<{
    success: boolean;
    data?: { id: number; tipo: CargoAddressTipo };
    error?: string;
  }> {
    return http("/api_cargo_addresses_compat", {
      method: "POST",
      body: { item: { cargo_id, tipo, ...fields } },
    });
  },
  /** Update fields of an existing row. */
  update(
    address_id: number,
    fields: Partial<CargoAddress>,
  ): Promise<{ success: boolean; error?: string }> {
    return http("/api_cargo_addresses_compat", {
      method: "POST",
      body: { item: { id: address_id, ...fields } },
    });
  },
  /**
   * "Usa la dirección de la sede": archiva la fila de presa para que el origen
   * vuelva a heredarse de sedi_interne. No toca ninguna columna del cargo.
   */
  useSede(cargo_id: number): Promise<{
    success: boolean;
    data?: { cargo_id: number; uses_sede_address: boolean; sede: CargoSede };
    error?: string;
  }> {
    return http("/api_cargo_addresses_compat", {
      method: "POST",
      body: { action: "use_sede", cargo_id },
    });
  },
  remove(address_id: number): Promise<{ success: boolean; error?: string }> {
    return http("/api_cargo_addresses_compat", {
      method: "POST",
      body: { action: "delete", id: address_id },
    });
  },
};

// ────────────────────────────────────────────────────────────
// Cargo list (paginated) — spedizioni_cargo
// Route: api_cargo_shipments (Web_Cargo_Shipments_List_Controller, hybrid auth)
// Backed by Cargo_Shipments_Request_Handler with response_format='api'.
// ────────────────────────────────────────────────────────────

export interface CargoListRow {
  id: number;
  awb: string;
  rif_cliente: string;
  cliente: string;
  /** Id de la anagrafica del cliente — se filtra por él (indexado) en vez de
   *  por el nombre vía `search`. Paridad con el listado courier. */
  id_cliente: number | null;
  airline: {
    code: string;
    name: string;
    full_name: string;
  };
  origin: {
    name: string;
    city: string;
    country: string;
    country_name: string;
    terminal: string;
  };
  destination: {
    name: string;
    city: string;
    country: string;
    country_name: string;
    terminal: string;
  };
  dates: {
    created: string | null;
    shipped: string | null;
    flight_departure: string | null;
    delivered: string | null;
  };
  weight: {
    declared: number;
    real: number;
    supplier_real: number;
  };
  packages: number;
  status: {
    code: string;
    label: string;
    color: string;
  };
  cost: {
    carico_volo: number;
    carico_extra: number;
    price_total: number;
    price_total_converted: number;
    costo_volo_previsto: number;
  };
  sede: {
    label: string;
    cargo_airport: string;
  };
  archived: boolean;
  controlled: boolean;
  days_in_transit: number | null;
  tipo_cons: string;
  labels: {
    ldv: boolean;
    pickup: boolean;
    delivery: boolean;
  };
}

export interface CargoListResponse {
  data: CargoListRow[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  filters: Record<string, unknown>;
  meta: {
    type: string;
    currency: string;
    query_mode: string;
    query_time_ms?: number;
  };
  error?: boolean | string;
  message?: string;
}

/**
 * Filters accepted by Cargo_Shipments_List_Controller.
 * See OpenAPI metadata in the controller for full descriptions.
 */
export interface CargoListQuery {
  page?: number;
  per_page?: number;
  /**
   * Listing macro type OR home-tile KPI key. The backend handler
   * (`Cargo_Shipments_Request_Handler::build_filters_from_params`)
   * accepts `all`/`in_transit` plus the legacy presets
   * (`toqt`, `clwt`, `nofly`, …); validation lives in
   * `cargo_list.store.normalisedType`.
   */
  type?: string;
  // Mirrors backend whitelist Cargo_Shipments_Request_Handler::ALLOWED_SORT_FIELDS.
  sort?:
    | "sp.data_sped0"
    | "sp.data_sped1"
    | "sp.data_volo_partenza"
    | "sp.consegna_data"
    | "sp.AWB_forn"
    | "sp.id"
    | "sp.colli"
    | "sp.peso"
    | "sp.peso_reale"
    | "sp.vettore_sigla"
    | "sp.carico_volo"
    | "sp.carico_extra"
    | "sp.terminal_part"
    | "sp.terminal_dest"
    | "ang.rag_soc"
    | "spi.id_paese_iso"
    | "spi2.id_paese_iso";
  sort_dir?: "ASC" | "DESC";
  search?: string;
  date_from?: string;
  date_to?: string;
  quale_data?: "data_sped1" | "data_volo_partenza";
  id_cliente?: number;
  id_sede?: number;
  airline_code?: string;
  vettore_sigla?: string;
  terminal_part?: string;
  terminal_dest?: string;
  /** Country ISO-2 filter (origin OR destination, disambiguated by cerca_pd). */
  paesex?: string;
  /** 'P' = origin, 'D' = destination — required alongside paesex. */
  cerca_pd?: string;
  include_archived?: boolean | "0" | "1";
  has_pending_offers?: boolean | "0" | "1";
  currency?: string;
  // W3 — cargo lifecycle filters (legacy `spedyc_cerca.php` parity).
  // NOTE: cargo schema (`spedizioni_cargo`) is DIFFERENT from express.
  // Express-only columns (contras_imp, peso_tassato, postfatt,
  // controllo_fatt, checkforn) are NOT here — they do not exist in
  // `spedizioni_cargo`.
  id?: number;
  AWB_forn?: string;
  RIF_cliente?: string;
  note?: string;
  gestione?: "N" | "F" | "O";
  offerta?: "A" | "R" | "";
  tipo_merce?: string;
  vettore_tipo?: string;
  flight_num1?: string;
  cargo_dazi?: string;
  // Cargo `controllata` is S/N only (no 'O' — that's express-only).
  controllata?: "S" | "N";
  archiviata?: "S" | "N";
  consegna_firma?: "S" | "N";
  peso_da?: number | string;
  peso_a?: number | string;
  /** Cargo chargeable-weight column — `pesor` (NOT `peso_tassato`). */
  pesor?: number | string;
  has_assicurazione?: "S";
  acc_dryice?: "S";
  acc_danggoods?: "S";
  acc_bancale?: "S";
  /** '1' = only shipments having unread chat messages. */
  chat_unread?: "1";
}

export const cargoListService = {
  fetch(
    q: CargoListQuery = {},
    opts: { signal?: AbortSignal } = {},
  ): Promise<CargoListResponse> {
    return http<CargoListResponse>("/api_cargo_shipments", {
      query: q as Record<string, unknown>,
      signal: opts.signal,
    });
  },

  /**
   * Bulk archive cargo shipments. Routes to /api_cargo_archive
   * (Set_Archiviata_Cargo_Controller) which accepts `id` as an array.
   */
  bulkArchive(ids: number[]): Promise<{ success: boolean; error?: string }> {
    return http("/api_cargo_archive", {
      method: "POST",
      body: { id: ids },
    });
  },

  bulkControl(ids: number[]): Promise<{ success: boolean; error?: string }> {
    return http("/api_cargo_review", {
      method: "POST",
      body: { id: ids },
    });
  },
};
