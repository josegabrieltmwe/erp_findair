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

/**
 * Memoria id→importe: la selección persiste entre páginas pero `rows` solo
 * contiene la página cargada, así que se recuerdan los importes vistos.
 */
export function rememberAmounts(
  known: Record<number, number>,
  rows: { id: number; contras_imp: number }[],
): Record<number, number> {
  const next = { ...known };
  for (const r of rows) next[r.id] = Number(r.contras_imp) || 0;
  return next;
}

/** Total de la selección completa (todas las páginas) a partir de lo recordado. */
export function selectedTotalKnown(
  known: Record<number, number>,
  selected: number[],
): number {
  const sum = selected.reduce((s, id) => s + (known[id] ?? 0), 0);
  return Math.round(sum * 100) / 100;
}

/** Un id de remesa válido es un entero positivo. */
export function isValidReportId(v: unknown): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

/** Importe en céntimos >= mínimo en euros; redondea para evitar 1.1*100=110.00000000000001. */
export function meetsMinAmount(
  cents: number | null | undefined,
  minEuros: number | null,
): boolean {
  if (minEuros === null) return true;
  return (cents ?? 0) >= Math.round(minEuros * 100);
}
