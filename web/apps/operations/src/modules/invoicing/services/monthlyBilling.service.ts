/**
 * monthlyBilling.service — facturación mensual manual. Endpoint
 * `api_invoice_generate` (Web_* wrapper):
 *   GET   vista previa por cliente (no escribe nada)
 *   POST  emisión (fiscal e irreversible; nunca se reintenta)
 */
import { http } from "./http";

export interface BillingParams {
  dal: string;
  al: string;
  minimo: number | null;
  solo_chiusi: boolean;
  no_giaccrm: boolean;
  no_cargo: boolean;
  no_express: boolean;
  /** Filtro opcional de la vista previa: un solo cliente. */
  id_cliente?: number | null;
}

export interface ClientValidation {
  valid: boolean;
  errors?: Record<string, string>;
}
export interface BillingClient {
  id_anagrafica: number;
  rag_soc?: string;
  total: number | string;
  shipment_count: number | string;
  shipments?: unknown[];
  validation?: ClientValidation;
}

export interface GeneratedInvoice {
  id_fattura: number;
  numero?: string | number;
  id_anagrafica?: number;
  importo_netto?: number;
  [k: string]: unknown;
}
export interface EmitResponse {
  generated: GeneratedInvoice[];
  errors: { id_anagrafica: number; error: string }[];
  skipped: { id_anagrafica: number; reason: string }[];
  summary?: Record<string, unknown>;
  warnings?: string[];
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

function p2(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Mes natural anterior a `today` (primer y último día). */
export function previousMonthRange(today: Date = new Date()): {
  dal: string;
  al: string;
} {
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last = new Date(today.getFullYear(), today.getMonth(), 0);
  return { dal: ymd(first), al: ymd(last) };
}

/**
 * Fecha de factura por defecto: el último día del periodo facturado (como en el ERP
 * original). Si el usuario ya la tocó a mano se respeta; si no, sigue al fin del periodo.
 */
export function defaultInvoiceDate(al: string, touched: boolean, current: string): string {
  if (touched && current) return current;
  return al || current;
}

export function todayYmd(today: Date = new Date()): string {
  return ymd(today);
}

function flags(p: BillingParams): Record<string, string> {
  const q: Record<string, string> = {};
  if (p.solo_chiusi) q.solo_chiusi = "1";
  if (p.no_giaccrm) q.no_giaccrm = "1";
  if (p.no_cargo) q.no_cargo = "1";
  if (p.no_express) q.no_express = "1";
  return q;
}

/** Query de la vista previa. */
export function buildPreviewQuery(p: BillingParams): Record<string, string> {
  const q: Record<string, string> = { dal: p.dal, al: p.al, ...flags(p) };
  if (p.minimo && p.minimo > 0) q.minimo = String(p.minimo);
  if (p.id_cliente && p.id_cliente > 0) q.id_cliente = String(p.id_cliente);
  return q;
}

/** Cuerpo de la emisión. Los flags van como booleanos. */
export function buildEmitBody(
  p: BillingParams,
  clientIds: number[],
  dataFattura: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    client_ids: clientIds,
    dal: p.dal,
    al: p.al,
    data_fattura: dataFattura,
    solo_chiusi: p.solo_chiusi,
    no_giaccrm: p.no_giaccrm,
    no_cargo: p.no_cargo,
    no_express: p.no_express,
  };
  if (p.minimo && p.minimo > 0) body.minimo = p.minimo;
  return body;
}

export type DateIssue = "required" | "invalid_range" | "before_dal" | null;

/** La fecha de factura no puede ser anterior al inicio del periodo. */
export function validateInvoiceDate(
  dataFattura: string,
  dal: string,
  al: string,
): DateIssue {
  if (!dataFattura) return "required";
  if (!dal || !al || dal > al) return "invalid_range";
  if (dataFattura < dal) return "before_dal";
  return null;
}

/** Motivos legibles por los que un cliente no se puede facturar. */
export function invalidReasons(c: BillingClient): string[] {
  if (c.validation?.valid !== false) return [];
  const e = c.validation.errors ?? {};
  return Object.values(e).map(String);
}

export function isBillable(c: BillingClient): boolean {
  return c.validation?.valid !== false && Number(c.total) > 0;
}

export function selectAllValid(clients: BillingClient[]): number[] {
  return clients.filter(isBillable).map((c) => Number(c.id_anagrafica));
}

export function totalOf(clients: BillingClient[], ids: number[]): number {
  const set = new Set(ids);
  const sum = clients
    .filter((c) => set.has(Number(c.id_anagrafica)))
    .reduce((s, c) => s + Number(c.total || 0), 0);
  return Math.round(sum * 100) / 100;
}

export type EmitFailure = "date" | "uncertain" | "rejected";

/**
 * Clasifica un fallo de emisión. Sin respuesta del servidor (corte, tiempo
 * agotado) o con error 5xx no se sabe si se emitió algo: "uncertain" obliga a
 * revisar antes de volver a emitir. Nunca se reintenta automáticamente.
 */
export function classifyEmitError(e: unknown): {
  kind: EmitFailure;
  message: string;
} {
  const err = e as {
    status?: number;
    errorCode?: string;
    message?: string;
  } | null;
  const message = err?.message ?? "";
  if (err?.status === 422 && err.errorCode === "INVOICE_DATE_NOT_CHRONOLOGICAL")
    return { kind: "date", message };
  if (!err?.status || err.status >= 500)
    return { kind: "uncertain", message: "" };
  return { kind: "rejected", message };
}

export type ResultKind = "generated" | "nothing" | "error" | "other";
export interface ResultRow {
  kind: ResultKind;
  id_anagrafica?: number;
  id_fattura?: number;
  numero?: string | number;
  detail?: string;
}

/** Une generadas, omitidas y errores en una lista por cliente. */
export function toResultRows(r: EmitResponse): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const g of r.generated ?? [])
    rows.push({
      kind: "generated",
      id_anagrafica: g.id_anagrafica,
      id_fattura: g.id_fattura,
      numero: g.numero,
    });
  for (const s of r.skipped ?? [])
    rows.push({
      kind: s.reason === "NOTHING_BILLABLE" ? "nothing" : "other",
      id_anagrafica: s.id_anagrafica,
      detail: s.reason,
    });
  for (const e of r.errors ?? [])
    rows.push({
      kind: "error",
      id_anagrafica: e.id_anagrafica,
      detail: e.error,
    });
  return rows;
}

export const monthlyBillingApi = {
  async preview(
    p: BillingParams,
    signal?: AbortSignal,
  ): Promise<BillingClient[]> {
    const res = await http<Envelope<{ clients?: BillingClient[] }>>(
      "/api_invoice_generate",
      { query: buildPreviewQuery(p), signal },
    );
    return res.data?.clients ?? [];
  },

  /** Una sola llamada, sin reintentos (el cliente http tiene retry: 0). */
  async emit(
    p: BillingParams,
    clientIds: number[],
    dataFattura: string,
  ): Promise<EmitResponse> {
    const res = await http<Envelope<Partial<EmitResponse>>>(
      "/api_invoice_generate",
      { method: "POST", body: buildEmitBody(p, clientIds, dataFattura) },
    );
    return {
      generated: res.data?.generated ?? [],
      errors: res.data?.errors ?? [],
      skipped: res.data?.skipped ?? [],
      summary: res.data?.summary,
      warnings: res.data?.warnings ?? [],
    };
  },
};
