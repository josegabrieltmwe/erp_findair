/**
 * Tipos del módulo consolidata (gestión del staff de los proyectos
 * consolidados). Reflejan el contrato de `unified_consolidation_project`
 * (ERP: Consolidation_Action_Catalog + servicios). No contienen reglas de
 * negocio: solo la forma de lo que devuelve el API.
 */

export type ProjectState = "A" | "P" | "C" | "X";

export const PROJECT_STATES: ProjectState[] = ["A", "P", "C", "X"];

export type Severity = "error" | "warn";

/** Fase derivada por el API (Consolidation_Queue_Query::fase_sql). `sin_asignar` solo es filtro/recuento. */
export type ProjectPhase =
  | "abierto"
  | "sin_asignar"
  | "pendiente_respuesta"
  | "respondido"
  | "respuesta_vencida"
  | "por_convertir"
  | "convertido"
  | "cancelado";

export const PROJECT_PHASES: ProjectPhase[] = [
  "abierto",
  "sin_asignar",
  "pendiente_respuesta",
  "respondido",
  "respuesta_vencida",
  "por_convertir",
  "convertido",
  "cancelado",
];

export type ConversionStatus = "no" | "parcial" | "completo";

export const PROJECT_TYPES = ["CONS", "XTRADE", "MULTI"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export interface QueueItem {
  id: number;
  titolo: string;
  tipo: string;
  stato: ProjectState;
  totale: number;
  valuta: string;
  id_cliente: number;
  cliente_nome: string | null;
  assegnato_a: number | null;
  assegnato_nome?: string | null;
  hub_terminal: string | null;
  dest_country: string | null;
  n_tratte: number;
  n_spedizioni: number;
  risposta_prezzo: number | null;
  risposta_at: string | null;
  risposta_valida_fino?: string | null;
  chiuso_at?: string | null;
  id_cargo?: number | null;
  fase?: ProjectPhase | null;
  conversione?: ConversionStatus | null;
  peso_tassabile?: number | null;
  partner_id?: number | null;
  partner_nome?: string | null;
  insert_datetime: string | null;
  modif_datetime: string | null;
}

export interface QueuePage {
  items: QueueItem[];
  count: number;
  current_page: number;
  max_page: number;
  per_page?: number;
  sort?: string;
  dir?: string;
}

/** view=queue_counts: recuento por fase con los mismos filtros (sin estado ni fase). `total` = no cancelados. */
export type QueueCounts = Record<ProjectPhase | "total", number>;

/** Proyecto resumido (view=by_cargo / view=by_spedizione). */
export interface ProjectRef {
  id: number;
  titolo: string;
  stato: ProjectState;
  fase?: ProjectPhase | null;
  conversione?: ConversionStatus | null;
  id_cliente: number;
  cliente_nome: string | null;
}

export interface StaffUser {
  id: number;
  nome: string;
}

export interface Leg {
  id: number;
  ordine: number;
  tipo: string;
  orig_paese: string;
  orig_cap: string;
  orig_citta: string;
  orig_terminal: string | null;
  dest_paese: string;
  dest_cap: string;
  dest_citta: string;
  dest_terminal: string | null;
  peso: number;
  colli: number;
  volume_cm3: number;
  merce: string | null;
  valore: number | null;
  servizio_nome: string | null;
  fonte_prezzo: string | null;
  prezzo: number;
  fuel: number;
  supplementi: number;
  totale: number;
  valuta: string;
  giorni: number | null;
  quotato_at: string | null;
  errore_quotazione: string | null;
  note: string | null;
  rate_ref?: string | null;
  pricing_snapshot?: string | null;
  peso_tassabile?: number | null;
  quote_valid_until?: string | null;
  aerolinea?: string | null;
  id_cargo?: number | null;
}

export interface LogEntry {
  id: number;
  id_tratta: number | null;
  azione: string;
  prima: unknown;
  dopo: unknown;
  user: number;
  user_nome?: string | null;
  datetime: string | null;
}

/** view=log: historial paginado. */
export interface LogPage {
  items: LogEntry[];
  count: number;
  current_page: number;
  max_page: number;
  per_page: number;
}

export interface ProjectDetail {
  id: number;
  id_cliente: number;
  titolo: string;
  tipo: string;
  stato: ProjectState;
  hub_terminal: string | null;
  dest_country: string | null;
  eori_dichiarante: string | null;
  valuta: string;
  totale: number;
  ricalcolato_at: string | null;
  note_specialist: string | null;
  assegnato_a?: number | null;
  id_cargo?: number | null;
  risposta_prezzo?: number | null;
  risposta_valuta?: string | null;
  risposta_valida_fino?: string | null;
  risposta_nota?: string | null;
  risposta_da?: number | null;
  risposta_at?: string | null;
  chiuso_at?: string | null;
  fase?: ProjectPhase | null;
  conversione?: ConversionStatus | null;
  cliente_nome?: string | null;
  assegnato_nome?: string | null;
  risposta_da_nome?: string | null;
  insert_datetime: string | null;
  modif_datetime: string | null;
  tratte: Leg[];
  log: LogEntry[];
}

export interface Shipment {
  id: number;
  ref: string;
  id_spedizione: number | null;
  orig_paese: string;
  orig_cap: string;
  orig_citta: string;
  orig_terminal: string | null;
  peso: number;
  colli: number;
  volume_cm3: number;
  peso_tassabile: number | null;
  politica_peso: string | null;
  valore: number | null;
  merce: string | null;
  data_pronta: string | null;
  quota_totale: number;
}

export interface ShipmentForm {
  ref: string;
  orig_paese: string;
  orig_cap: string;
  orig_citta: string;
  orig_terminal: string;
  peso: number | null;
  colli: number | null;
  volume_cm3: number | null;
  valore: number | null;
  merce: string;
  data_pronta: string;
  id_spedizione: number | null;
}

export interface AllocationRow {
  id_tratta: number;
  id_prog_sped: number;
  criterio: string;
  base: number;
  quota: number;
  valuta: string;
}

export interface ShipmentsView {
  spedizioni: Shipment[];
  riparto: AllocationRow[];
  criterio: string;
  totale_tratte: number;
  totale_riparto: number;
}

export interface Warning {
  codice: string;
  severita: Severity;
  id_prog_sped: number | null;
  messaggio: string;
  ignorato: boolean;
  motivo_ignorato?: string;
}

export interface Readiness {
  avisos: Warning[];
  bloqueantes: number;
  pendientes: number;
  listo: boolean;
}

export interface InternalNote {
  id: number;
  nota: string;
  user: number;
  user_nome?: string | null;
  datetime: string | null;
}

export interface HouseResult {
  ref: string;
  id_spedizione: number | null;
  success: boolean;
  house_id?: number;
  idempotent?: boolean;
  pendiente?: boolean;
  code?: string;
  error?: string;
}

export interface ConversionResult {
  id: number;
  id_cargo: number;
  houses: HouseResult[];
  enlazadas: number;
  pendientes: number;
  completo: boolean;
}

/** Paso de conversión (view=conversion, tabla progetti_conversione_passi). */
export type ConversionStepKind =
  | "cargo"
  | "spedizione"
  | "collegare"
  | "casa"
  | "prenotare"
  | "camion"
  | "prezzo";

export interface ConversionStep {
  passo: ConversionStepKind | string;
  /** Clave del paso: ref de la house, o el id del proyecto para los pasos globales. */
  chiave: string;
  stato: string;
  tentativi: number;
  risultato_id: number | null;
  errore?: string | null;
  insert_datetime?: string | null;
  modif_datetime?: string | null;
  [k: string]: unknown;
}

export interface OperateHouse {
  ref: string;
  id_spedizione: number | null;
  house_id?: number | null;
  hawb?: string | null;
  error?: string | null;
  [k: string]: unknown;
}

/** Respuesta de `operate`. */
export interface OperateResult {
  id: number;
  id_cargo: number | null;
  houses: OperateHouse[];
  reserva?: unknown;
  pendientes: number;
  completo: boolean;
  modo?: string;
  camion?: unknown;
}

export interface BulkAssignResult {
  results: Array<{ id: number; success: boolean; code?: string }>;
}

export interface CreateProjectPayload {
  titolo: string;
  tipo: ProjectType;
  id_cliente: number;
  hub_terminal?: string;
  dest_country?: string;
  eori_dichiarante?: string;
  note_specialist?: string;
}

/** Extremo de un tramo (claves inglesas: lo que valida validate_leg del API). */
export interface LegEndpoint {
  country: string;
  zip: string;
  city: string;
  terminal?: string;
}

export const LEG_TYPES = [
  "FEEDER",
  "AIR",
  "DELIVERY",
  "TRANSIT",
  "ROAD",
  "DIRECT",
] as const;

/** Payload de add_leg (Consolidation_Project_Service::validate_leg). */
export interface LegPayload {
  tipo: (typeof LEG_TYPES)[number];
  origin: LegEndpoint;
  destination: LegEndpoint;
  weight: number;
  packages?: QuotePackage[];
  goods?: string;
  value?: number;
  note?: string;
  price_source?: "listino" | "realtime" | "manuale";
  manual_price?: { prezzo: number; fuel?: number; supplementi?: number };
}

export interface CreateFromOptionPayload {
  /** Opción completa tal como la devolvió `quote` (el API exige `legs`). */
  option: QuoteOption;
  shipments: QuoteShipmentInput[];
  destination: QuoteAddress;
  titolo: string;
  customer_id: number;
}

export interface AnswerPayload {
  prezzo: number;
  valida_fino?: string;
  nota?: string;
}

export interface PricePayload {
  prezzo: number;
  fuel?: number;
  supplementi?: number;
  motivo: string;
}

export interface ApiMeta {
  api_version: string;
  states: Record<string, string>;
  actions: Record<
    string,
    { verb: string; audience: string; from: string[] | null; to: string | null }
  >;
  limits: { max_legs: number; max_shipments: number; currency: string };
  warning_codes: string[];
  /** La reserva real en el vendor está activada (CONSOLIDATION_ALLOW_BOOKING). */
  booking_allowed?: boolean;
}

// ─── Cotización rápida (unified_consolidation_quote, sin crear proyecto) ────

export interface QuotePackage {
  quantity: number;
  weight: number;
  length: number;
  width: number;
  height: number;
}

export interface QuoteAddress {
  country: string;
  zip: string;
  city: string;
  terminal?: string;
}

export interface QuoteShipmentInput {
  ref: string;
  origin: QuoteAddress;
  weight: number;
  packages: QuotePackage[];
  goods?: string;
  value?: number;
  ready_date?: string;
}

export interface QuoteRequest {
  shipments: QuoteShipmentInput[];
  destination: QuoteAddress;
  candidate_hubs?: string[];
  preference?: "price" | "speed" | "balanced";
}

export interface QuoteLeg {
  tipo: string;
  ordine: number;
  origin: QuoteAddress;
  destination: QuoteAddress;
  prezzo: number;
  fuel: number;
  supplementi: number;
  totale: number;
  valuta: string;
  servizio_nome: string | null;
  fonte_prezzo: string | null;
  errore: string | null;
  giorni: number | null;
}

export interface QuoteFixedCosts {
  pratiche_export: number;
  export_clearance: number;
  house: number;
  house_fee: number;
  hub_handling_kg: number;
  hub_handling: number;
  shuttle?: number;
  shuttle_km?: number;
  totale: number;
}

export interface QuoteOption {
  key: string;
  label: string;
  hub_terminal: string | null;
  legs: QuoteLeg[];
  totale_tratte: number;
  costi_fissi: QuoteFixedCosts;
  totale: number;
  valuta: string;
  note: string[];
  incomplete: boolean;
  dominated: boolean;
  dominated_by: string | null;
  giorni_totali: number | null;
  eta: string | null;
}

export interface QuoteResult {
  options: QuoteOption[];
  recommended: string;
  recommendation_reason: { code: string; text: string };
  preference: string;
  warnings: string[];
  compliance: { review_required: boolean; restricted_countries: string[] };
  hub_candidates: string[];
}

/** Error normalizado del API de consolidación. */
export interface ConsolidataError {
  code: string;
  message: string;
  status: number;
  /** VALIDATION_ERROR: campo → mensaje */
  fields: Record<string, string>;
  /** conversion_blocked: avisos que bloquean */
  avisos: Warning[];
  /** invalid_state: estados admitidos */
  allowedStates: string[];
}
