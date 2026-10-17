/**
 * Tipos del módulo consolidata (gestión del staff de los proyectos
 * consolidados). Reflejan el contrato de `unified_consolidation_project`
 * (ERP: Consolidation_Action_Catalog + servicios). No contienen reglas de
 * negocio: solo la forma de lo que devuelve el API.
 */

export type ProjectState = "A" | "P" | "C" | "X";

export const PROJECT_STATES: ProjectState[] = ["A", "P", "C", "X"];

export type Severity = "error" | "warn";

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
  hub_terminal: string | null;
  dest_country: string | null;
  n_tratte: number;
  n_spedizioni: number;
  risposta_prezzo: number | null;
  risposta_at: string | null;
  insert_datetime: string | null;
  modif_datetime: string | null;
}

export interface QueuePage {
  items: QueueItem[];
  count: number;
  current_page: number;
  max_page: number;
}

export interface QueueFilters {
  /** "" = todos los estados */
  stato: ProjectState | "";
  /** "" = todos, "me" = míos, "none" = sin asignar */
  assegnato_a: "" | "me" | "none";
  id_cliente: number | null;
}

export function emptyQueueFilters(): QueueFilters {
  return { stato: "P", assegnato_a: "", id_cliente: null };
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
  datetime: string | null;
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
