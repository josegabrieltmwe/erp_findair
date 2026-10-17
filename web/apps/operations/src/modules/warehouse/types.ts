export interface Parcel {
  id: number;
  n_collo?: number | string | null;
  peso?: number | string | null;
  dim_a?: number | string | null;
  dim_l?: number | string | null;
  dim_p?: number | string | null;
  id_spedizione?: number | null;
  sticker?: string | null;
  ldv_stampata?: string | null;
  [k: string]: unknown;
}

export interface ValidationResult {
  found: boolean;
  source: "spedizioni_colli" | "orphan" | null;
  message?: string;
  parcel: Parcel | null;
}

export interface Completeness {
  shipment_id: number;
  status: string;
  colli_expected?: number;
  colli_total?: number;
  colli_weighed?: number;
  colli_printed?: number;
  colli_with_driver?: number;
  orphans_associated?: number;
  orphans_unassigned?: number;
  issues?: string[];
}

export interface CompletenessItem {
  id: number;
  id_cliente?: number;
  colli?: number | string;
  peso?: number | string;
  completeness: {
    expected: number;
    colli_total: number;
    colli_weighed: number;
    colli_printed: number;
    colli_with_driver: number;
    status: "complete" | "incomplete";
  };
  [k: string]: unknown;
}

export interface Pagination {
  total: number;
  page: number;
  per_page: number;
  total_pages?: number;
}

export interface Envelope<T> {
  success: boolean;
  data: T;
  pagination?: Pagination;
  error?: string;
}

export interface DriverRef {
  id: number;
  nome: string;
  [k: string]: unknown;
}

export interface LoadedParcel {
  id: number;
  id_spedizione: number;
  n_collo?: number | string;
  segnac_cliente?: string;
  AWB_forn?: string;
  peso?: number | string;
  ldv_stampata?: string;
  RIF_cliente?: string;
}

export interface DriverLoading {
  driver_id: number;
  date: string;
  parcel_count: number;
  shipment_count: number;
  parcels: LoadedParcel[];
}

export interface LdvInfo {
  id: number | null;
  ldv: string;
  destinatario: string;
  indirizzo: string;
  citta: string;
  cap: string;
  stato_sped: string;
}

export interface PodRequest {
  ldv: string;
  esito: string;
  firma?: string;
  note?: string;
  data_consegna: string;
}

export interface PodResult {
  id: number;
  shipment_id: number;
  delivery_claimed: boolean | null;
}

export interface ManifestHistoryItem {
  id: number;
  insert_datetime: string;
  invio_ftp: string | null;
  id_fornitore: number;
  fornitore_nome: string;
  num_spedizioni: number;
}

export interface ManifestHistory {
  date?: string;
  carrier?: string;
  items: ManifestHistoryItem[];
  pagination?: Pagination;
}

export interface BrtManifestResult {
  id_manifest: number;
  shipments: number;
  request_id: string;
  status: string;
}

export interface TrackingStatusLite {
  id: number;
  descr_ita?: string | null;
  descr_eng?: string | null;
  descr_spa?: string | null;
  stato?: string;
  /** D entregado, P problema, R devolución, T tránsito, C en reparto, 0 otros. */
  tipo?: string;
  /** 'S' = abre una retención de stock. */
  apri_giac?: string;
}

export type OutcomeGroup = "delivered" | "exception";

export interface Outcome {
  id: string;
  label: string;
  delivered: boolean;
  group: OutcomeGroup;
  opensHold: boolean;
}

export interface PendingClient {
  id_cliente: number;
  rag_soc: string;
  shipments: number;
  parcels: number;
  unweighed: number;
  unprinted: number;
}

export interface PendingClients {
  days: number;
  clients: PendingClient[];
}

export interface PendingShipment {
  id: number;
  RIF_cliente?: string | null;
  declared_parcels: number;
  parcels: number;
  weighed: number;
  unprinted: number;
  insert_datetime?: string | null;
  complete: boolean;
  all_weighed: boolean;
}

export interface PendingShipments {
  days: number;
  client_id: number;
  shipments: PendingShipment[];
}
