/**
 * payments.service — cobros y pagos de facturas. Endpoints (Web_* wrappers):
 *   GET        api_payments                 listado global de cuotas / por factura
 *   POST       api_payments?op=register     cobro total o parcial
 *   POST       api_payments?op=reopen       deshacer un cobro
 *   POST       api_bulk_payment             cierre masivo (todo o nada)
 *   GET        api_payment_aging            antigüedad de saldos
 *   POST/PUT   api_bank_reconciliation      conciliación bancaria
 *   GET        api_payment_methods          métodos de pago (servicio compartido)
 * Las respuestas son `{ success, data, pagination?, summary? }`.
 */
import { paymentsService as sharedPayments } from "@shared/anagrafiche/services/payments.service";
import { http } from "./http";
import type {
  AgingResult,
  BankTransaction,
  BulkCollectResult,
  BulkErrorItem,
  ConfirmMatch,
  ConfirmResult,
  InvoicePayments,
  PaymentFilters,
  PaymentListParams,
  PaymentListResult,
  PaymentMethod,
  PaymentRow,
  ReconciliationResult,
  RegisterPaymentPayload,
  RegisterPaymentResult,
  StatementFormat,
} from "../types";

interface Envelope<T> {
  success: boolean;
  data: T;
  pagination?: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
  summary?: { total_amount?: number | string };
  error?: string;
}

/** Tamaño máximo de página que acepta el backend. */
export const MAX_PER_PAGE = 100;

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "" || Number.isNaN(v);
}

/** Construye los query params del listado: solo manda los filtros con valor. */
export function buildListQuery(
  filters: PaymentFilters,
  params: PaymentListParams,
): Record<string, string | number> {
  const q: Record<string, string | number> = {
    page: params.page,
    per_page: Math.min(params.perPage, MAX_PER_PAGE),
  };
  const keys: (keyof PaymentFilters)[] = [
    "tipo",
    "statop",
    "id_anagrafica",
    "scad_dal",
    "scad_al",
    "close_dal",
    "close_al",
    "importo",
    "id_pagam_metodi",
  ];
  for (const k of keys) {
    const v = filters[k];
    if (!isEmpty(v)) q[k] = v as string | number;
  }
  if (params.sort) {
    q.sort = params.sort;
    q.sort_dir = params.sortDir ?? "ASC";
  }
  return q;
}

/** Extrae los errores por fila de una respuesta 422 del cierre masivo. */
export function parseBulkErrors(payload: unknown): BulkErrorItem[] {
  const p = payload as {
    error?: { details?: { validation_errors?: BulkErrorItem[] } };
    details?: { validation_errors?: BulkErrorItem[] };
  } | null;
  const list =
    (typeof p?.error === "object"
      ? p.error?.details?.validation_errors
      : undefined) ?? p?.details?.validation_errors;
  return Array.isArray(list)
    ? list.map((e) => ({ id: Number(e.id), reason: String(e.reason ?? "") }))
    : [];
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export const paymentsApi = {
  async list(
    filters: PaymentFilters,
    params: PaymentListParams,
    signal?: AbortSignal,
  ): Promise<PaymentListResult> {
    const res = await http<Envelope<PaymentRow[]>>("/api_payments", {
      query: buildListQuery(filters, params),
      signal,
    });
    const rows = (res.data ?? []).map((r) => ({
      ...r,
      importo: num(r.importo),
      days_overdue: num(r.days_overdue),
    }));
    return {
      rows,
      total: res.pagination?.total ?? rows.length,
      totalAmount: num(res.summary?.total_amount),
    };
  },

  /** Recorre todas las páginas del resultado filtrado (para exportar). */
  async listAll(
    filters: PaymentFilters,
    sort: Pick<PaymentListParams, "sort" | "sortDir">,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<PaymentRow[]> {
    const all: PaymentRow[] = [];
    let page = 1;
    for (;;) {
      const res = await paymentsApi.list(filters, {
        page,
        perPage: MAX_PER_PAGE,
        ...sort,
      });
      all.push(...res.rows);
      onProgress?.(all.length, res.total);
      if (res.rows.length < MAX_PER_PAGE || all.length >= res.total) break;
      page += 1;
    }
    return all;
  },

  async forInvoice(
    idFattura: number,
    signal?: AbortSignal,
  ): Promise<InvoicePayments> {
    const res = await http<Envelope<InvoicePayments>>("/api_payments", {
      query: { id_fattura: idFattura },
      signal,
    });
    return res.data;
  },

  async register(
    payload: RegisterPaymentPayload,
  ): Promise<RegisterPaymentResult> {
    const body: Record<string, unknown> = {
      id: payload.id,
      date: payload.date,
    };
    if (!isEmpty(payload.amount)) body.amount = payload.amount;
    if (!isEmpty(payload.id_pagam_metodi))
      body.id_pagam_metodi = payload.id_pagam_metodi;
    const res = await http<Envelope<RegisterPaymentResult>>("/api_payments", {
      method: "POST",
      query: { op: "register" },
      body,
    });
    return res.data ?? {};
  },

  async reopen(id: number): Promise<void> {
    await http<Envelope<unknown>>("/api_payments", {
      method: "POST",
      query: { op: "reopen" },
      body: { id },
    });
  },

  /** Cierre masivo todo o nada. Un 422 devuelve los errores por fila sin lanzar. */
  async bulkCollect(
    paymentIds: number[],
    date: string,
  ): Promise<BulkCollectResult> {
    try {
      await http<Envelope<unknown>>("/api_bulk_payment", {
        method: "POST",
        body: { payment_ids: paymentIds, date },
      });
      return { ok: true, errors: [] };
    } catch (e) {
      // Comprobación por forma (status/payload de ApiError), no por clase.
      const err = e as { status?: number; payload?: unknown; message?: string };
      if (err?.status === 422) {
        return {
          ok: false,
          errors: parseBulkErrors(err.payload),
          message: err.message,
        };
      }
      throw e;
    }
  },

  async aging(
    params: { customerId?: number | null; daysThreshold?: number | null } = {},
    signal?: AbortSignal,
  ): Promise<AgingResult> {
    const query: Record<string, number> = {};
    if (!isEmpty(params.customerId))
      query.customer_id = params.customerId as number;
    if (!isEmpty(params.daysThreshold))
      query.days_threshold = params.daysThreshold as number;
    const res = await http<Envelope<AgingResult>>("/api_payment_aging", {
      query,
      signal,
    });
    return res.data;
  },

  /** Analiza un extracto (MT940 / CAMT.053 / CSV) y propone coincidencias. */
  async reconcileFile(
    file: File,
    opts: { format?: StatementFormat | ""; delimiter?: string } = {},
  ): Promise<ReconciliationResult> {
    const form = new FormData();
    form.append("statement", file);
    if (opts.format) form.append("format", opts.format);
    if (opts.delimiter) form.append("delimiter", opts.delimiter);
    const res = await http<Envelope<ReconciliationResult>>(
      "/api_bank_reconciliation",
      {
        method: "POST",
        body: form,
      },
    );
    return normalizeReconciliation(res.data);
  },

  async reconcileTransactions(
    transactions: BankTransaction[],
  ): Promise<ReconciliationResult> {
    const res = await http<Envelope<ReconciliationResult>>(
      "/api_bank_reconciliation",
      {
        method: "POST",
        body: { transactions },
      },
    );
    return normalizeReconciliation(res.data);
  },

  async confirmMatches(matches: ConfirmMatch[]): Promise<ConfirmResult> {
    const res = await http<Envelope<ConfirmResult>>(
      "/api_bank_reconciliation",
      {
        method: "PUT",
        body: { matches },
      },
    );
    return {
      confirmed: num(res.data?.confirmed),
      errors: res.data?.errors ?? [],
    };
  },

  /** Métodos de pago para los selects (servicio compartido de anagrafiche). */
  async methods(): Promise<PaymentMethod[]> {
    const list = await sharedPayments.paymentMethods();
    return list.map((m) => ({
      id: Number(m.id),
      label: String(m.descr ?? m.descrEN ?? m.id),
    }));
  },
};

function normalizeReconciliation(
  d: ReconciliationResult | undefined,
): ReconciliationResult {
  return {
    matched: (d?.matched ?? []).map((m) => ({
      transaction: { ...m.transaction, amount: num(m.transaction.amount) },
      pagamento: { ...m.pagamento, importo: num(m.pagamento.importo) },
    })),
    unmatched: (d?.unmatched ?? []).map((t) => ({
      ...t,
      amount: num(t.amount),
    })),
    summary: d?.summary,
    format: d?.format,
  };
}

// ── Utilidades puras ────────────────────────────────────────────────────────

/** YYYY-MM-DD de hoy en hora local. */
export function today(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Escapa un valor para CSV (separador `;`, comillas dobles). */
export function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

/** Descarga un texto como fichero (BOM para que Excel respete UTF-8). */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(["﻿", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
