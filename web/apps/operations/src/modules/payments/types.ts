/** Tipos del módulo payments (cobros y pagos de facturas, scadenzario, aging y conciliación). */

/** A = por cobrar (facturas activas), P = por pagar (facturas pasivas). */
export type PaymentTipo = "A" | "P";
export type PaymentStatus = "paid" | "overdue" | "pending";
/** Filtro de estado de la API: O abiertas, C cerradas, SC solo vencidas, 10/30 = vencidas ≥ N días. */
export type PaymentStatop = "O" | "C" | "SC" | "10" | "30";
export type PaymentSortKey =
  | "scadenza"
  | "importo"
  | "data_close"
  | "numero"
  | "data_fattura"
  | "rag_soc"
  | "id";

/** Cuota abierta si `data_close` vale esto (o está vacía). */
export const OPEN_DATE = "0000-00-00";

/** Fila del listado global de cuotas (GET api_payments sin id_fattura). */
export interface PaymentRow {
  id: number;
  id_fattura: number;
  tipo: PaymentTipo;
  importo: number;
  scadenza: string;
  data_close: string;
  id_pagam_metodi: number | null;
  numero: string | number;
  data_fattura: string;
  id_anagrafica: number;
  valuta_sigla: string;
  rag_soc: string;
  days_overdue: number;
  status: PaymentStatus;
}

/** Cuota dentro de una factura (GET api_payments?id_fattura=). */
export interface InvoicePaymentRow {
  id: number;
  id_fattura?: number;
  tipo?: PaymentTipo;
  importo: number;
  scadenza: string;
  data_close: string;
  id_pagam_metodi: number | null;
  status?: PaymentStatus;
  days_overdue?: number;
}

export interface InvoicePayments {
  id_fattura: number;
  invoice_total: number;
  currency: string;
  payments: InvoicePaymentRow[];
  total_paid: number;
  total_pending: number;
  balance: number;
}

export interface PaymentFilters {
  tipo?: PaymentTipo;
  statop?: PaymentStatop;
  id_anagrafica?: number | null;
  scad_dal?: string;
  scad_al?: string;
  close_dal?: string;
  close_al?: string;
  importo?: number | null;
  id_pagam_metodi?: number | null;
}

export interface PaymentListParams {
  page: number;
  perPage: number;
  sort?: PaymentSortKey;
  sortDir?: "ASC" | "DESC";
}

export interface PaymentListResult {
  rows: PaymentRow[];
  total: number;
  totalAmount: number;
}

export interface PaymentMethod {
  id: number;
  label: string;
}

/** Cobro (total o parcial) de una cuota. */
export interface RegisterPaymentPayload {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  /** Omitido = importe total. */
  amount?: number;
  id_pagam_metodi?: number | null;
}

export interface RegisterPaymentResult {
  payment?: InvoicePaymentRow;
  /** Cuota restante cuando el cobro es parcial. */
  remainder?: InvoicePaymentRow | null;
}

export interface BulkErrorItem {
  id: number;
  reason: string;
}

export interface BulkCollectResult {
  ok: boolean;
  /** Errores por fila cuando el backend rechaza el lote (422). */
  errors: BulkErrorItem[];
  message?: string;
}

export type AgingBandKey = "0_30" | "31_60" | "61_90" | "90_plus";

export interface AgingBand {
  count: number;
  amount: number;
}

export interface AgingCustomerRow {
  id_anagrafica: number;
  rag_soc: string;
  total: number;
  overdue: number;
}

export interface AgingResult {
  summary: { total_outstanding: number; total_overdue: number };
  bands: Record<AgingBandKey, AgingBand>;
  by_customer: AgingCustomerRow[];
}

export type StatementFormat = "mt940" | "camt053" | "csv";

export interface BankTransaction {
  amount: number;
  date: string;
  reference: string;
  description: string;
}

export interface MatchedItem {
  transaction: BankTransaction;
  pagamento: PaymentRow;
}

export interface ReconciliationResult {
  matched: MatchedItem[];
  unmatched: BankTransaction[];
  summary?: Record<string, number>;
  format?: string;
}

export interface ConfirmMatch {
  pagamento_id: number;
  transaction_ref: string;
  data_close: string;
  amount?: number;
}

export interface ConfirmResult {
  confirmed: number;
  errors: { pagamento_id: number; error: string }[];
}
