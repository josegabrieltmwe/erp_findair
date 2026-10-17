/**
 * Conciliación de contrareembolsos (COD). Endpoints (Web_* wrappers, auth
 * híbrida sesión/Bearer):
 *   GET  api_cod_reconciliation?list=pending|to_report&page&per_page&...
 *   GET  api_cod_reconciliation?summary=1&date_from&date_to
 *   POST api_cod_reconciliation {action:'reconcile'|'assign_report', ...}
 *   POST api_cod_export {date_from,date_to,format}  -> fichero en base64
 */
import { http } from "@shared/anagrafiche/services/http";
import type { ApiEnvelope } from "../types";

export type ReconList = "pending" | "to_report";

export const MAX_PER_PAGE = 100;

export interface ReconFilters {
  date_from?: string;
  date_to?: string;
  carrier_id?: number | null;
}

export interface ReconRow {
  id: number;
  AWB_forn: string | null;
  contras_imp: number;
  contras_incasso: string;
  contras_data_inc: string | null;
  contras_id_report: number;
  data_sped0: string | null;
  consegna_data: string | null;
  cliente_nome: string | null;
  servizio_nome: string | null;
}

export interface ReconPage {
  items: ReconRow[];
  total: number;
  page: number;
  per_page: number;
}

export interface ReconSummary {
  total_shipments: number;
  total_amount: number;
  pending_count: number;
  pending_amount: number;
  to_report_count: number;
  reported_count: number;
  cancelled_count: number;
}

export interface CodExportFile {
  file: string;
  filename: string;
  mime_type: string;
  size: number;
}

const BASE = "/api_cod_reconciliation";

function qs(params: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  return q.toString();
}

export function buildListUrl(
  list: ReconList,
  filters: ReconFilters,
  page: number,
  perPage: number,
): string {
  return `${BASE}?${qs({
    list,
    page: Math.max(1, page),
    per_page: Math.min(Math.max(1, perPage), MAX_PER_PAGE),
    date_from: filters.date_from,
    date_to: filters.date_to,
    carrier_id: filters.carrier_id,
  })}`;
}

export function buildSummaryUrl(dateFrom?: string, dateTo?: string): string {
  return `${BASE}?${qs({ summary: 1, date_from: dateFrom, date_to: dateTo })}`;
}

export function buildReconcileBody(
  shipmentId: number,
  collectionDate: string,
  state: string,
) {
  return {
    action: "reconcile",
    shipment_id: shipmentId,
    collection_date: collectionDate,
    state,
  };
}

export function buildAssignBody(shipmentIds: number[], reportId: number) {
  return {
    action: "assign_report",
    shipment_ids: shipmentIds,
    report_id: reportId,
  };
}

function ensure<T>(res: ApiEnvelope<T>, fallback: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.error ?? fallback);
  }
  return res.data;
}

function normRow(r: ReconRow): ReconRow {
  return {
    ...r,
    contras_imp: Number(r.contras_imp) || 0,
    contras_id_report: Number(r.contras_id_report) || 0,
  };
}

export async function fetchList(
  list: ReconList,
  filters: ReconFilters,
  page: number,
  perPage: number,
): Promise<ReconPage> {
  const res = await http<ApiEnvelope<ReconPage>>(
    buildListUrl(list, filters, page, perPage),
  );
  const d = ensure(res, "Could not load the list");
  return { ...d, items: (d.items ?? []).map(normRow), total: Number(d.total) };
}

export async function fetchSummary(
  dateFrom?: string,
  dateTo?: string,
): Promise<ReconSummary | null> {
  const res = await http<ApiEnvelope<ReconSummary>>(
    buildSummaryUrl(dateFrom, dateTo),
  );
  const d = ensure(res, "Could not load the summary");
  return d && "total_shipments" in d ? d : null;
}

export async function reconcile(
  shipmentId: number,
  collectionDate: string,
  state: string,
): Promise<void> {
  const res = await http<ApiEnvelope<unknown>>(BASE, {
    method: "POST",
    body: buildReconcileBody(shipmentId, collectionDate, state),
  });
  ensure(res, "Could not mark the shipment as collected");
}

export async function assignReport(
  shipmentIds: number[],
  reportId: number,
): Promise<{ count: number; total: number }> {
  const res = await http<ApiEnvelope<{ count: number; total: number }>>(BASE, {
    method: "POST",
    body: buildAssignBody(shipmentIds, reportId),
  });
  return ensure(res, "Could not assign the remittance report");
}

export async function exportCod(
  dateFrom: string,
  dateTo: string,
  format: "xlsx" | "csv",
): Promise<CodExportFile> {
  const res = await http<ApiEnvelope<CodExportFile>>(
    "/api_cod_export",
    {
      method: "POST",
      body: { date_from: dateFrom, date_to: dateTo, format },
    },
  );
  const d = ensure(res, "Export failed");
  if (!d.file) throw new Error("Export failed");
  return d;
}

/** Decodifica base64 a Blob y dispara la descarga en el navegador. */
export function saveBase64File(f: CodExportFile): void {
  const bin = atob(f.file);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(
    new Blob([bytes], { type: f.mime_type || "application/octet-stream" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = f.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
