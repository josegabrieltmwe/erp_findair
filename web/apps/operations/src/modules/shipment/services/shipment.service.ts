import { http } from "./http";
import type {
  Shipment,
  ShipmentCrudResponse,
  ShipmentUpdateResponse,
} from "./shipment.types";

export interface LoadShipmentOptions {
  withPackages?: boolean;
  withSupplements?: boolean;
  withFiles?: boolean;
}

export interface SetFlagResult {
  success: boolean;
  error?: string;
}

/**
 * Shipment CRUD wrapper around ajax_shipment_crud (Ajax_Shipment_Crud_Controller).
 *
 * GET  ?id=N&with_packages&with_supplements&with_files → full shipment payload
 * POST { item: {id, ...} } / { id, action:'delete' }
 */
export const shipmentService = {
  load(
    id: number,
    opts: LoadShipmentOptions = {},
  ): Promise<ShipmentCrudResponse> {
    return http<ShipmentCrudResponse>("/ajax_shipment_crud", {
      query: {
        id,
        with_packages: opts.withPackages ? "true" : undefined,
        with_supplements: opts.withSupplements ? "true" : undefined,
        with_files: opts.withFiles ? "true" : undefined,
      },
    });
  },

  update(
    id: number,
    patch: Partial<Shipment>,
  ): Promise<ShipmentUpdateResponse> {
    return http<ShipmentUpdateResponse>("/ajax_shipment_crud", {
      method: "POST",
      body: { item: { id, ...patch } },
    });
  },

  cancel(id: number): Promise<{ success: boolean; error?: string }> {
    return http("/ajax_cancel_shipment", {
      method: "POST",
      body: { shipment_id: id },
    });
  },

  setArchiviata(id: number, value: "S" | "N"): Promise<SetFlagResult> {
    return http<SetFlagResult>("/set_archiviata", {
      method: "POST",
      body: { shipment_id: id, value },
    });
  },

  setControllata(id: number, value: "S" | "N" | "O"): Promise<SetFlagResult> {
    return http<SetFlagResult>("/set_controllata", {
      method: "POST",
      body: { shipment_id: id, value },
    });
  },

  setPrivate(id: number, value: "S" | "N"): Promise<SetFlagResult> {
    return http<SetFlagResult>("/set_private", {
      method: "POST",
      body: { shipment_id: id, value },
    });
  },

  /**
   * Launch tracking for one shipment on demand, from the list row. Synchronous
   * and persisting (the admin single track updates consegna_stato, sends the
   * delivery email, opens giacenza and records awb_reso_tnt). Returns
   * processed>0 when the courier answered.
   */
  launchTracking(
    id: number,
  ): Promise<{ success: boolean; processed?: number; error?: string }> {
    return http<{ success: boolean; processed?: number; error?: string }>(
      "/admin_tracking_api",
      {
        method: "POST",
        body: { action: "single", shipment_id: id },
      },
    );
  },

  /**
   * Launch tracking for several selected shipments at once. Enqueues a
   * background job (does NOT block FPM) and returns its id; the tracking runs
   * off-request and persists like the cron. Same admin endpoint, action
   * "batch_ids".
   */
  bulkTracking(ids: number[]): Promise<{
    success: boolean;
    queued?: boolean;
    job_id?: number;
    error?: string;
  }> {
    return http<{
      success: boolean;
      queued?: boolean;
      job_id?: number;
      error?: string;
    }>("/admin_tracking_api", {
      method: "POST",
      body: { action: "batch_ids", shipment_ids: ids },
    });
  },

  fromCargo(
    cargo_id: number,
    tpc: "P" | "D" | "H" | "Q",
  ): Promise<{ success: boolean; shipment_id?: number; error?: string }> {
    return http("/ajax_shipment_from_cargo", {
      method: "POST",
      body: { cargo_id, tpc },
    });
  },

  /**
   * Bulk operations. The legacy controllers accept `id` as an array and use
   * the `id[instring]` DB operator under the hood (see Abstract_Spedizioni::set_*).
   * Single-shipment helpers above use `shipment_id` for compat with their own
   * controllers — DO NOT consolidate, they hit different endpoints.
   */
  bulkArchive(ids: number[]): Promise<SetFlagResult> {
    return http<SetFlagResult>("/set_archiviata", {
      method: "POST",
      body: { id: ids },
    });
  },

  bulkControl(ids: number[]): Promise<SetFlagResult> {
    return http<SetFlagResult>("/set_controllata", {
      method: "POST",
      body: { id: ids },
    });
  },
};

// ────────────────────────────────────────────────────────────
// Listing (paginated)
// Route: api_courier_shipments (Web_Shipments_List_Controller, hybrid auth)
// Backed by Shipments_List_Request_Handler with response_format='api'.
// ────────────────────────────────────────────────────────────

export interface ShipmentListRow {
  id: number;
  awb: string;
  cliente: string;
  /** Id de la anagrafica del cliente — se filtra por él (indexado) en vez de
   *  por el nombre vía `search`, que hace LIKE sobre 3 tablas. */
  id_cliente: number | null;
  servizio: string;
  origin: {
    name: string;
    city: string;
    country: string;
  };
  destination: {
    name: string;
    city: string;
    country: string;
  };
  dates: {
    created: string | null;
    shipped: string | null;
    carrier: string | null;
    delivered: string | null;
  };
  weight: {
    real: number;
    charged: number;
  };
  packages: number;
  status: {
    code: string;
    label: string;
    color: string;
  };
  cost: {
    amount: number;
    converted: number;
  };
  cod: {
    amount: number;
    collected: string;
  };
  days_in_transit: number | null;
}

export interface ShipmentListResponse {
  data: ShipmentListRow[];
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
 * Filters accepted by Shipments_List_Controller (60+ filters in 6 tabs).
 * Subset of common ones is exposed here; all controller params are passed through.
 */
export interface ShipmentListQuery {
  page?: number;
  per_page?: number;
  /**
   * Listing macro type OR home-tile KPI key. The backend handler
   * (`Shipments_List_Request_Handler::build_filters_from_params`) accepts
   * the four macro categories plus every legacy preset
   * (`preseint`, `dacontr`, `badaddr`, …); the front-end no longer
   * pre-validates these to a closed union — see
   * `shipment_list.store.normalisedType` for the runtime allowlist.
   */
  type?: string;
  tiz?: string;
  // Mirrors backend whitelist Shipments_List_Request_Handler::ALLOWED_SORT_FIELDS.
  sort?:
    | "sp.data_sped0"
    | "sp.data_sped1"
    | "sp.data_corriere"
    | "sp.consegna_data"
    | "sp.AWB_forn"
    | "sp.id"
    | "sp.colli"
    | "sp.peso"
    | "sp.peso_tassato"
    | "sp.peso_reale"
    | "sp.id_fornitore"
    | "sp.id_servizio"
    | "sp.consegna_stato"
    | "sp.controllata"
    | "ang.rag_soc"
    | "spi.id_paese_iso"
    | "spi2.id_paese_iso";
  sort_dir?: "ASC" | "DESC";
  search?: string;
  currency?: string;
  view_mode?: "b2b" | "erp";

  // TAB 1: BÁSICOS
  id?: number;
  AWB_forn?: string;
  peso_tassato?: string;
  id_cliente?: number;
  id_sede?: number;
  RIF_cliente?: string;
  id_servizio?: number;
  id_fornitore?: number;
  note?: string;
  cod_cli_forn?: string;
  of_partn?: string;
  opz_par_doc?: string;
  /** W1.D1 — exact match on chargeable weight (legacy parity). */
  peso_tassax?: number | string;
  /** '1' = only shipments having unread chat messages. */
  chat_unread?: "1";
  /** Weight range (kg). */
  peso_da?: number | string;
  peso_a?: number | string;
  date_field?: "data_sped0" | "data_sped1" | "data_corriere" | "consegna_data";
  date_from?: string;
  date_to?: string;

  // TAB 2: UBICACIÓN
  location_type?: string;
  country_iso?: string;
  city?: string;
  location_name?: string;
  cap?: string;

  // TAB 3: IMPORTES
  amount_field?: string;
  amount_from?: number;
  amount_to?: number;

  // TAB 4: ESTADOS
  consegna_stato?: string;
  presa_stato?: string;
  controllata?: "S" | "N" | "O";
  consegna_firma?: "S" | "N";
  stato_giac?: string;
  stato_crm?: string;
  archiviata?: "S" | "N";
  pesate?: string;
  colli_multipli?: string;

  // TAB 5: DOCUMENTOS
  id_fattura_a?: number;
  controllo_fatt?: string;
  checkforn?: string;
  postfatt?: string;
  DDT_pronto?: string;
  DDT_cliente?: string;
  matricola?: string;

  // TAB 6: OPCIONES
  // Backend (Shipments_List_Request_Handler) accepts strictly 'S'.
  has_contrassegno?: "S";
  has_assicurazione?: "S";
  presa_tipo?: string;
  presa_fornitore?: string;
  acc_aree_remote?: string;
  acc_fuori_misura?: string;
  costo_daverif?: string;
  suppl_attivi?: string;
}

export const shipmentListService = {
  fetch(
    q: ShipmentListQuery = {},
    opts: { signal?: AbortSignal } = {},
  ): Promise<ShipmentListResponse> {
    return http<ShipmentListResponse>("/api_courier_shipments", {
      query: q as Record<string, unknown>,
      signal: opts.signal,
    });
  },
};

// ────────────────────────────────────────────────────────────
// Owner reassignment
// Route: api_shipment_owner_options (Web_Shipment_Owner_Options_Controller, hybrid auth)
// Mirrors cargo.service.ts ownerService — see Cargo_Owner_Options_Controller.
// ────────────────────────────────────────────────────────────

/** One assignable owner user (partner-scoped). */
export interface OwnerOption {
  id: number;
  name: string;
  email: string;
  login: string;
}

/**
 * Owner reassignment — lists the users (contatti) of the shipment's owning
 * partner that can be set as `owner_user`. Hybrid-auth web wrapper of
 * api_shipment_owner_options. The actual write goes through the normal
 * shipment PATCH ({ owner_user }) via shipmentService.update, audited
 * server-side via Log_Modifiche and subject to READONLY_FIELDS_INVOICED.
 */
export const ownerService = {
  async options(
    shipment_id: number,
  ): Promise<{ options: OwnerOption[]; current_owner: number }> {
    const res = await http<{
      success: boolean;
      data?: { options: OwnerOption[]; current_owner: number };
    }>("/api_shipment_owner_options", { query: { shipment_id } });
    return {
      options: res?.data?.options ?? [],
      current_owner: Number(res?.data?.current_owner ?? 0),
    };
  },
};
