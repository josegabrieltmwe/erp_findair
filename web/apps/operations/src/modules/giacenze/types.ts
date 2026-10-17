/**
 * Tipos del dominio giacenze. Reflejan la tabla `giacenze` (Inventory_Model) y
 * las respuestas de los 3 controllers (Inventory_Crud / Operations / Aging).
 * NO inventar columnas: la tabla NO tiene id_cliente, peso, colli ni stato_giacenza.
 */

/** Operación de la giacenza (operazione). A=Aperta C=Chiusa N=Note R=Riconsegna E=Esitata. */
export type GiacenzaOperation = "A" | "C" | "N" | "R" | "E";

export const GIACENZA_OPERATIONS: readonly GiacenzaOperation[] = [
  "A",
  "C",
  "N",
  "R",
  "E",
];

/** Campos de fecha de contacto editables (CONTACT_DATE_FIELDS del service). */
export const CONTACT_DATE_FIELDS = [
  "cont_fornitore_data",
  "cont_cliente_data",
  "cont_destin_data",
  "risp_cliente_data",
] as const;
export type ContactDateField = (typeof CONTACT_DATE_FIELDS)[number];

/** Un registro de giacenza tal como lo devuelve el backend (enriquecido). */
export interface Giacenza {
  id: number;
  id_spedizione: number;
  descriz: string | null;
  operazione: GiacenzaOperation | null;
  note: string | null;
  data_open: string | null;
  data_close: string | null;
  giacenza_gg: number | null;
  addebito_riconsegna: number | null;
  cont_fornitore_data: string | null;
  cont_cliente_data: string | null;
  cont_destin_data: string | null;
  risp_cliente_data: string | null;
  stato: string;
  insert_datetime?: string | null;
  insert_user?: string | null;
  // Derivados por el JOIN del listado (Inventory_Model): nombre del cliente y
  // descripción del estado de tracking. Solo vienen en el listado, no en el
  // detalle por id.
  id_cliente?: number;
  cliente_rag_soc?: string | null;
  tracking_descr?: string | null;
  // Campos derivados por enrich_with_currency_display:
  // `addebito_riconsegna` está en EUR (así lo guarda la BD); `_display` es ese
  // importe convertido a la divisa del titolare, que es lo que ve el operador.
  addebito_riconsegna_currency?: string;
  addebito_riconsegna_display?: number;
  /** La expedición ya fue post-facturada: el importe no se puede modificar. */
  addebito_riconsegna_locked?: boolean;
}

/** Filtros del listado (mapean a los query params del controller). */
export interface GiacenzaFilters {
  indicator: "open_giacenze" | "giacenze_overdue_15" | "awaiting_client_response" | null;
  id_spedizione: number | null;
  id_cliente: number | null;
  q: string | null;
  operazione: GiacenzaOperation | null;
  data_open_da: string | null;
  data_open_a: string | null;
  open_only: boolean;
}

export function emptyFilters(): GiacenzaFilters {
  return {
    indicator: null,
    id_spedizione: null,
    id_cliente: null,
    q: null,
    operazione: null,
    data_open_da: null,
    data_open_a: null,
    open_only: false,
  };
}

/** Envelope paginado del backend (paginated_response). */
export interface PaginationMeta {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  from: number;
  to: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Una banda del análisis de aging. */
export interface AgingBand {
  label: string;
  min: number;
  max: number | null;
  count: number;
}

/** Respuesta completa del endpoint de aging. */
export interface AgingResult {
  bands: AgingBand[];
  summary: {
    total: number;
    avg_days: number;
    max_days: number;
  };
  filter: {
    partner_id: number | null;
  };
}

/** Payload para crear/actualizar la cabecera de una giacenza. */
export interface GiacenzaWritePayload {
  id_spedizione: number;
  operazione: GiacenzaOperation;
  descriz?: string | null;
  note?: string | null;
  data_open?: string | null;
  data_close?: string | null;
  giacenza_gg?: number | null;
  addebito_riconsegna?: number | null;
  /**
   * Divisa en la que va `addebito_riconsegna`. El backend convierte a EUR
   * antes de persistir; si se omite asume EUR (fallback).
   */
  addebito_riconsegna_currency?: string;
  cont_fornitore_data?: string | null;
  cont_cliente_data?: string | null;
  cont_destin_data?: string | null;
  risp_cliente_data?: string | null;
}

/** Una fila de dirección de expedición (spedizioni_indirizzi). */
export interface ShipmentAddress {
  id: number;
  tipo: string;
  nome: string | null;
  adress: string | null;
  cap: string | null;
  citta: string | null;
  prov: string | null;
  id_paese_iso: string | null;
  tel: string | null;
  attenzione: string | null;
}

/** Respuesta de api_shipment_addresses: entrega actual (D) y original (V). */
export interface ShipmentAddresses {
  shipment_id: number;
  delivery: ShipmentAddress | null;
  /** Destino ORIGINAL (tipo V), presente solo si la entrega se redirigió. */
  delivery_original: ShipmentAddress | null;
}

/** Una fila del historial de mensajes de una giacenza (docsstory). */
export interface GiacenzaMessage {
  id: number;
  tipo: string;
  descriz: string | null;
  metodo: string | null;
  dest_msg: string | null;
  esito: string | null;
  insert_datetime: string | null;
}
