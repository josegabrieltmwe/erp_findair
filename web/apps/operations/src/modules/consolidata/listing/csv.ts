/**
 * Exportación CSV del listado en el navegador (sin trabajo en segundo plano:
 * el API aún no tiene un tipo de export para consolidata, P75). Se piden
 * páginas de 100 hasta un máximo de filas y se genera un CSV con las columnas
 * de la vista activa: UTF-8 con BOM y separador `;` (lo que Excel abre bien
 * con configuración regional europea).
 */
import type { QueryParams } from "../services/consolidata.service";
import type { QueueItem, QueuePage } from "../types";

export const CSV_PAGE_SIZE = 100;
export const CSV_MAX_ROWS = 2000;

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * Celda CSV: se entrecomilla si lleva separador, comillas o saltos de línea. Un texto que empieza por
 * `= + - @`, tabulador o retorno de carro lleva delante un apóstrofo: Excel lo trataría como fórmula
 * (inyección CSV; el título del proyecto lo escribe el cliente). Los números no se tocan.
 */
export function csvEscape(
  v: string | number | null | undefined,
  sep = ";",
): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (
    s.includes(sep) ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  sep = ";",
): string {
  const lines = [columns.map((c) => csvEscape(c.label, sep)).join(sep)];
  for (const r of rows)
    lines.push(columns.map((c) => csvEscape(c.value(r), sep)).join(sep));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/**
 * Pide las páginas del filtro actual hasta `max` filas. `fetchPage` recibe los
 * parámetros completos (página incluida) y devuelve la respuesta del API.
 */
export async function fetchAllRows(
  base: QueryParams,
  fetchPage: (params: QueryParams) => Promise<QueuePage>,
  max = CSV_MAX_ROWS,
): Promise<{ rows: QueueItem[]; total: number; truncated: boolean }> {
  const rows: QueueItem[] = [];
  let page = 1;
  let total = 0;
  for (;;) {
    const res = await fetchPage({ ...base, page, per_page: CSV_PAGE_SIZE });
    total = Number(res.count) || 0;
    rows.push(...(res.items ?? []));
    if (
      rows.length >= max ||
      page >= (Number(res.max_page) || 1) ||
      !(res.items ?? []).length
    )
      break;
    page += 1;
  }
  return { rows: rows.slice(0, max), total, truncated: total > max };
}

/** Descarga el texto como fichero (solo navegador). */
export function downloadText(
  content: string,
  filename: string,
  mime = "text/csv;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
