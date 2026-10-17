/**
 * invoiceExport.service — exportaciones del listado de facturas:
 *   - recapitulativa intra-UE (api_intra_eu_recap_export, CSV, GET)
 *   - listado anual de facturas (api_balance_sheet_export, XLSX/CSV, POST)
 * Ambas devuelven el fichero en base64 dentro del JSON.
 */
import { http } from "./http";
import { downloadBase64 } from "./einvoice.service";

export interface ExportFile {
  filename: string;
  mime: string;
  base64: string;
}

export type BalanceType = "active" | "passive";
export type BalanceFormat = "xlsx" | "csv";

export function quarterRange(
  year: number,
  quarter: 1 | 2 | 3 | 4,
): { desde: string; hasta: string } {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    desde: `${year}-${pad(startMonth)}-01`,
    hasta: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
  };
}

/** Query de la recapitulativa: desde/hasta obligatorios, país opcional (ISO-2). */
export function buildIntraEuQuery(
  desde: string,
  hasta: string,
  pais?: string,
): string {
  const p = new URLSearchParams({ desde, hasta });
  const c = (pais ?? "").trim().toUpperCase();
  if (c) p.set("pais", c);
  return p.toString();
}

export function buildBalanceBody(
  type: BalanceType,
  year: number,
  format: BalanceFormat,
): { type: BalanceType; year: number; format: BalanceFormat } {
  return { type, year, format };
}

interface RawFile {
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

/** El fichero viene en `data` (envelope) o en la raíz según el wrapper. */
function pickFile(
  res: RawFile,
  b64Key: "csv" | "file",
  fallbackName: string,
  fallbackMime: string,
): ExportFile {
  const src = (res.data ?? res) as Record<string, unknown>;
  const base64 = typeof src[b64Key] === "string" ? (src[b64Key] as string) : "";
  if (!base64) throw new Error("EMPTY_EXPORT");
  return {
    base64,
    filename: typeof src.filename === "string" ? src.filename : fallbackName,
    mime: typeof src.mime_type === "string" ? src.mime_type : fallbackMime,
  };
}

export const invoiceExportService = {
  async intraEu(desde: string, hasta: string, pais?: string): Promise<ExportFile> {
    const res = await http<RawFile>(
      `/api_intra_eu_recap_export?${buildIntraEuQuery(desde, hasta, pais)}`,
    );
    return pickFile(res, "csv", `recapitulativa_${desde}_${hasta}.csv`, "text/csv");
  },

  async balance(
    type: BalanceType,
    year: number,
    format: BalanceFormat,
  ): Promise<ExportFile> {
    const res = await http<RawFile>(`/api_balance_sheet_export`, {
      method: "POST",
      body: buildBalanceBody(type, year, format),
    });
    return pickFile(
      res,
      "file",
      `fatture_${type}_${year}.${format}`,
      "application/octet-stream",
    );
  },

  save(file: ExportFile): void {
    downloadBase64(file.base64, file.filename, file.mime);
  },
};
