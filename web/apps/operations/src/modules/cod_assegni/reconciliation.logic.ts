/**
 * Lógica pura de la conciliación COD: estados y selección en lote.
 * Estados = enum `contras_incasso` del backend.
 */
export type CodState = "0" | "N" | "C" | "AB1" | "B" | "AB2" | "AC" | "CLC";

export const ALL_STATES: CodState[] = [
  "0",
  "N",
  "C",
  "AB1",
  "B",
  "AB2",
  "AC",
  "CLC",
];

/** Estados que el operador puede asignar al marcar un cobro. */
export const COLLECT_STATES: CodState[] = ["C", "B", "AB1", "AB2"];

export const DEFAULT_COLLECT_STATE: CodState = "C";

/** Clave i18n del estado; los desconocidos caen en "unknown". */
export function stateLabelKey(state: string | null | undefined): string {
  const s = String(state ?? "").trim();
  return (ALL_STATES as string[]).includes(s)
    ? `cod_assegni.recon.state.${s}`
    : "cod_assegni.recon.state.unknown";
}

/** Alterna un id en la selección sin mutar el array original. */
export function toggleSelection(selected: number[], id: number): number[] {
  return selected.includes(id)
    ? selected.filter((x) => x !== id)
    : [...selected, id];
}

/** Selecciona/deselecciona todas las filas de la página actual. */
export function setPageSelection(
  selected: number[],
  pageIds: number[],
  on: boolean,
): number[] {
  const rest = selected.filter((x) => !pageIds.includes(x));
  return on ? [...rest, ...pageIds] : rest;
}

/** Suma de importes de las filas seleccionadas (redondeada a 2 decimales). */
export function selectedTotal(
  rows: { id: number; contras_imp: number }[],
  selected: number[],
): number {
  const sum = rows
    .filter((r) => selected.includes(r.id))
    .reduce((s, r) => s + (Number(r.contras_imp) || 0), 0);
  return Math.round(sum * 100) / 100;
}

/** Un id de remesa válido es un entero positivo. */
export function isValidReportId(v: unknown): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}
