export type DocRole = "summary" | "contrassegno";
export type CheckSource = "photo_ocr" | "manual";

/**
 * How a cheque got tied to a shipment — or why it did not.
 *
 * These stay apart on purpose. Collapsing them into "matched / not matched"
 * would erase the only distinction that matters here: `matched` is the document
 * read verbatim off the paper resolving to exactly one shipment of that carrier,
 * while `return_match` was DERIVED from the carrier's +1 return leg and
 * `cash_return` has no AWB at all. Money must never move on a derived reading
 * nobody looked at.
 */
export type MatchState =
  | "pending"
  /** Read verbatim, resolved to exactly one shipment. Nothing to decide. */
  | "matched"
  /** Found via the carrier's return leg (paper = AWB+1). Real, but derived. */
  | "return_match"
  /** An "AS" document: cash returned, no AWB to match on. Needs a person. */
  | "cash_return"
  /** More than one shipment carries that AWB — AWB_forn is not unique. */
  | "ambiguous"
  | "not_found"
  /** A person decided. Permanent: a rerun never overwrites it. */
  | "manual"
  | "rejected";

export type ProcState =
  | "pending"
  | "queued"
  | "extracted"
  | "failed"
  | "reviewed"
  | "applied"
  | "rejected";

export type SessionState = "A" | "C" | "O";

export interface Carrier {
  id: number;
  label: string;
}

export interface CaptureSession {
  id: number;
  id_fornitore: number;
  bill_no: string | null;
  bill_date: string | null;
  descriz: string | null;
  files_count: number;
  max_files: number;
  stato: SessionState;
  scadenza: string | null;
  created: string;
  ultimo_uso: string | null;
  expired: boolean;
}

/**
 * What a batch is waiting for, without opening it.
 *
 * `errore` first: a photo the AI could not read is the one thing nobody chases
 * unless it is said out loud. Then cheques needing a decision, then batches
 * merely waiting on the AI (work in flight, not a problem).
 */
export type Urgency = "errore" | "decisione" | "lettura" | "pronto";

export interface PendingSession extends CaptureSession {
  fornitore_nome: string;
  n_assegni: number;
  /** Cheques nobody has ruled on. These block approval. */
  da_decidere: number;
  /** Ruled on, not yet written to the shipment. */
  da_approvare: number;
  approvati: number;
  /** Photos the AI has not read yet. */
  in_lettura: number;
  falliti: number;
  totale: string;
  totale_cents: number;
  urgenza: Urgency;
}

export interface CreatedSession {
  id: number;
  url: string;
  qr_png_base64: string | null;
  scadenza: string;
  id_fornitore?: number;
  /** Present when the session was created but the QR worker did not answer. */
  warning?: string;
}

export interface CaptureFile {
  id: number;
  id_file: number;
  ruolo: DocRole;
  n_righe: number;
  stato_proc: ProcState;
  error_msg: string | null;
}

/**
 * A cheque as the ERP sees it: the capture PLUS the shipment analysis.
 *
 * The phone gets a strictly smaller shape — no id_spedizione, no stato_match.
 * Two jobs, two people: confirming a reading and signing off a settlement are
 * different decisions.
 */
export interface ReviewCheck {
  id: number;
  file_id: number;
  fonte: DocRole;
  numero_assegno: string;
  banca: string | null;
  documento: string | null;
  /** Integer cents everywhere. Money never travels as a float. */
  importo_cents: number;
  importo: string;
  valuta: string | null;
  confidence: number;
  source: CheckSource;
  reviewed: boolean;
  applied: boolean;
  id_spedizione: number;
  stato_match: MatchState;
  match_note: string | null;
  /** Server-decided: a row a person still has to rule on. */
  needs_decision: boolean;
}

export interface AttentionRow {
  id: number;
  numero_assegno: string;
  documento: string | null;
  stato_match: MatchState;
  match_note: string | null;
}

export interface ReviewTotals {
  count: number;
  cents: number;
  amount: string;
  by_state: Record<string, number>;
}

export interface ReviewBatch {
  session: {
    id: number;
    id_fornitore: number;
    bill_no: string | null;
    bill_date: string | null;
    descriz: string | null;
    stato: SessionState;
    files_count: number;
  };
  files: CaptureFile[];
  checks: ReviewCheck[];
  totals: ReviewTotals;
  /** Already ordered by the server: cash returns first. */
  attention: AttentionRow[];
}

/**
 * A shipment offered for an AS cash return.
 *
 * The carrier's own rule is the only handle here: amount (to the cent) + a date
 * window around the batch + optionally the customer. Shape mirrors
 * Cod_Shipment_Model::find_cod_candidates() exactly.
 */
export interface Suggestion {
  id: number;
  AWB_forn: string | null;
  id_fornitore: number;
  id_cliente: number;
  RIF_cliente: string | null;
  contras_imp: string | number;
  contras_incasso: string | number | null;
  data_sped0: string | null;
  consegna_data: string | null;
  cliente_nome: string | null;
}

export interface SuggestionResult {
  candidates: Suggestion[];
  total: number;
  /** True only when exactly one shipment fits. One is worth saying out loud. */
  exact: boolean;
}

/** A gap between the cheques and what was invoiced. Reported, never fixed. */
export interface Divergence {
  id_spedizione: number;
  expected: string;
  got: string;
  delta_cents: number;
  note: string;
}

export interface ApplyReport {
  applied: number;
  shipments: number;
  /** Rows nobody has ruled on yet: they stay on the workbench. */
  skipped: number;
  divergences: Divergence[];
  warnings: string[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string;
}
