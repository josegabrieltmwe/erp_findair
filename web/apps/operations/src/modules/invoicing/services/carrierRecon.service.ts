/**
 * carrierRecon.service — conciliación de costes de transportistas.
 * Endpoint `api_carrier_reconciliation` (Web_* wrapper), siempre sobre UNA
 * factura de proveedor:
 *   POST op=import  multipart `file` + invoice_id [+ carrier, dry_run]
 *   GET  op=discrepancies | (listado) ?invoice_id
 *   GET  op=checks [&tipo]      incidencias guardadas de la última importación
 *   GET  op=overview            una fila por factura de proveedor, con contadores
 *   POST op=accept  {invoice_id, shipment_id, reason}
 *   POST op=flag    {invoice_id, shipment_id}   (repercutir la diferencia)
 */
import { http } from "./http";

export const CARRIERS = ["BRT", "DHL", "TNT", "UPS", "PPW"] as const;
export type Carrier = (typeof CARRIERS)[number];
export const MAX_CARRIER_BYTES = 20 * 1024 * 1024;

export type RowStatus =
  | "associated"
  | "already_linked"
  | "not_found"
  | "other_invoice"
  | "duplicate"
  | "format_error"
  | "info";

export interface ImportRow {
  line: number;
  awb: string;
  riferimento: string;
  shipment_id: number | null;
  amount: number | null;
  overrun: boolean;
  status: RowStatus | string;
  message: string;
}
export interface ImportResult {
  invoice_id: number;
  carrier: string;
  dry_run: boolean;
  records: number;
  skipped: number;
  associated: number;
  ok: number;
  overrun: number;
  already_linked: number;
  format_errors: number;
  not_found: number;
  other_invoice: number;
  duplicates: number;
  rows: ImportRow[];
}

/** Estado de conciliación de una factura de proveedor en la vista global. */
export type OverviewStatus =
  | "empty"
  | "discrepancies"
  | "recharge"
  | "pending"
  | "ok";

export const OVERVIEW_COLOR: Record<OverviewStatus, string> = {
  empty: "grey",
  discrepancies: "error",
  recharge: "warning",
  pending: "info",
  ok: "success",
};

export interface OverviewRow {
  id: number;
  numero_alfanum: string | null;
  data_fattura: string;
  importo_netto: number;
  importo_iva: number;
  valuta_sigla: string;
  supplier_id: number;
  supplier_name: string | null;
  shipment_count: number;
  discrepancy_count: number;
  pending_recharge_count: number;
  reconciled_count: number;
  total_delta: number;
  status: OverviewStatus;
}

/** Facturas que piden atención: sin envíos, con diferencias o con repercusión pendiente. */
export function overviewNeedsAttention(
  r: Pick<OverviewRow, "status">,
): boolean {
  return (
    r.status === "empty" ||
    r.status === "discrepancies" ||
    r.status === "recharge"
  );
}

export interface ReconShipment {
  id: number;
  RIF_cliente?: string;
  data_sped0?: string;
  costo_previsto: number | string;
  costo_reale: number | string;
  delta_costo: number | string;
  reconciliation_status: "ok" | "discrepancy" | string;
  controllo_fatt?: string | null;
  postfatt?: string | number | null;
}
export interface ReconSummary {
  shipment_count?: number;
  discrepancy_count?: number;
  total_delta?: number;
  pending_recharge_count?: number;
  reconciled_count?: number;
  tolerance?: number;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  pagination?: { total: number };
  summary?: ReconSummary;
}

/**
 * Incidencias que dejó la última importación del fichero (fatture_check):
 * C cabecera · A asociada · S sobrecoste · D doble · F formato ·
 * G ya conciliada en otra factura · N no encontrada.
 */
export const CHECK_TYPES = ["S", "N", "G", "D", "F", "A", "C"] as const;
export type CheckType = (typeof CHECK_TYPES)[number];

export const CHECK_COLOR: Record<CheckType, string> = {
  S: "error",
  N: "warning",
  G: "warning",
  D: "warning",
  F: "error",
  A: "success",
  C: "grey",
};

export interface CheckRow {
  id: number;
  tipo_record: CheckType | string;
  riga_num: number;
  riga_max: number;
  riga_orig: number;
  id_spediz: number;
  descr: string;
  riga_txt: string;
  insert_datetime?: string;
}
export type ChecksByType = Partial<Record<CheckType, number>>;

/** Las incidencias que piden revisión (todas menos asociada y cabecera). */
export function checkNeedsAttention(type: string): boolean {
  return !["A", "C"].includes(type);
}

export function validateCarrierFile(
  file: { name: string; size: number } | null | undefined,
): "ok" | "missing" | "bad_type" | "too_big" {
  if (!file) return "missing";
  if (!/\.(csv|txt|tsv)$/i.test(file.name)) return "bad_type";
  if (file.size > MAX_CARRIER_BYTES) return "too_big";
  return "ok";
}

export function buildImportForm(
  invoiceId: number,
  file: File,
  carrier: string,
  dryRun: boolean,
): FormData {
  const f = new FormData();
  f.append("op", "import");
  f.append("invoice_id", String(invoiceId));
  f.append("file", file);
  if (carrier) f.append("carrier", carrier);
  if (dryRun) f.append("dry_run", "1");
  return f;
}

export const STATUS_COLOR: Record<string, string> = {
  associated: "success",
  already_linked: "info",
  not_found: "warning",
  other_invoice: "warning",
  duplicate: "warning",
  format_error: "error",
  info: "grey",
};

/** Una fila es un problema si no se casó o se pasó del coste previsto. */
export function rowNeedsAttention(r: ImportRow): boolean {
  if (r.overrun) return true;
  return !["associated", "already_linked", "info"].includes(r.status);
}

/** Diferencia real − previsto, con dos decimales. */
export function deltaOf(
  s: Pick<ReconShipment, "costo_previsto" | "costo_reale">,
): number {
  return (
    Math.round((Number(s.costo_reale) - Number(s.costo_previsto)) * 100) / 100
  );
}

export const carrierReconApi = {
  async importFile(
    invoiceId: number,
    file: File,
    carrier: string,
    dryRun: boolean,
  ): Promise<ImportResult> {
    const res = await http<Envelope<ImportResult>>(
      "/api_carrier_reconciliation",
      {
        method: "POST",
        query: { op: "import" },
        body: buildImportForm(invoiceId, file, carrier, dryRun),
      },
    );
    return { ...res.data, rows: res.data?.rows ?? [] };
  },

  async list(
    invoiceId: number,
    opts: { onlyDiscrepancies: boolean; page: number; perPage: number },
    signal?: AbortSignal,
  ): Promise<{ items: ReconShipment[]; total: number; summary: ReconSummary }> {
    const query: Record<string, string | number> = {
      invoice_id: invoiceId,
      page: opts.page,
      per_page: Math.min(opts.perPage, 100),
    };
    if (opts.onlyDiscrepancies) query.op = "discrepancies";
    const res = await http<Envelope<ReconShipment[]>>(
      "/api_carrier_reconciliation",
      { query, signal },
    );
    const items = Array.isArray(res.data) ? res.data : [];
    return {
      items,
      total: res.pagination?.total ?? items.length,
      summary: res.summary ?? {},
    };
  },

  async overview(
    opts: { attention: boolean; from?: string; page: number; perPage: number },
    signal?: AbortSignal,
  ): Promise<{
    items: OverviewRow[];
    total: number;
    from: string;
    tolerance: number;
  }> {
    const query: Record<string, string | number> = {
      op: "overview",
      page: opts.page,
      per_page: Math.min(opts.perPage, 100),
    };
    if (opts.attention) query.attention = 1;
    if (opts.from) query.from = opts.from;
    const res = await http<
      Envelope<OverviewRow[]> & { from?: string; tolerance?: number }
    >("/api_carrier_reconciliation", { query, signal });
    const items = Array.isArray(res.data) ? res.data : [];
    return {
      items,
      total: res.pagination?.total ?? items.length,
      from: res.from ?? "",
      tolerance: Number(res.tolerance ?? 0),
    };
  },

  async checks(
    invoiceId: number,
    opts: { tipo?: CheckType | ""; page: number; perPage: number },
    signal?: AbortSignal,
  ): Promise<{ items: CheckRow[]; total: number; byType: ChecksByType }> {
    const query: Record<string, string | number> = {
      op: "checks",
      invoice_id: invoiceId,
      page: opts.page,
      per_page: Math.min(opts.perPage, 100),
    };
    if (opts.tipo) query.tipo = opts.tipo;
    const res = await http<Envelope<CheckRow[]> & { by_type?: ChecksByType }>(
      "/api_carrier_reconciliation",
      { query, signal },
    );
    const items = Array.isArray(res.data) ? res.data : [];
    return {
      items,
      total: res.pagination?.total ?? items.length,
      byType: res.by_type ?? {},
    };
  },

  async accept(invoiceId: number, shipmentId: number, reason: string) {
    await http("/api_carrier_reconciliation", {
      method: "POST",
      body: {
        op: "accept",
        invoice_id: invoiceId,
        shipment_id: shipmentId,
        reason: reason.trim(),
      },
    });
  },

  async flag(invoiceId: number, shipmentId: number) {
    await http("/api_carrier_reconciliation", {
      method: "POST",
      body: { op: "flag", invoice_id: invoiceId, shipment_id: shipmentId },
    });
  },
};
