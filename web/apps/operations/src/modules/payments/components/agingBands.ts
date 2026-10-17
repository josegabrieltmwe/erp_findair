import type { AgingBandKey } from "../types";

export interface AgingBandQuery {
  scad_dal?: string;
  scad_al?: string;
}

function ymd(d: Date): string {
  const p = (x: number): string => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysAgo(today: Date, n: number): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() - n);
  return ymd(d);
}

/**
 * Filtro de vencimiento que reproduce cada tramo de antigüedad del backend:
 * `0_30` incluye lo aún no vencido (sin límite superior), `31_60` y `61_90`
 * son rangos cerrados y `90_plus` no tiene límite inferior.
 */
export function agingBandQuery(
  key: AgingBandKey,
  today: Date = new Date(),
): AgingBandQuery {
  switch (key) {
    case "0_30":
      return { scad_dal: daysAgo(today, 30) };
    case "31_60":
      return { scad_dal: daysAgo(today, 60), scad_al: daysAgo(today, 31) };
    case "61_90":
      return { scad_dal: daysAgo(today, 90), scad_al: daysAgo(today, 61) };
    case "90_plus":
      return { scad_al: daysAgo(today, 91) };
  }
}
