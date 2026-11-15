/**
 * Lógica pura de presentación del fuel efectivo en la ficha "Servizi e
 * tariffe" (AnagraficaListiniSection.vue). Extraída del componente para que
 * se pueda probar con Vitest sin montar Vue/Vuetify (el workspace de
 * `apps/operations` solo ejecuta specs de lógica pura, ver su vitest.config.ts).
 *
 * El backend (`Anagrafiche_Listvol::get_service_grid_for_client`) modela el
 * fuel del cliente como un delta sobre el fuel del servizio (puede ser
 * negativo = descuento) y devuelve tres campos en la grilla:
 *   - servizio_fuel: fuel base del servizio.
 *   - fuel_cliente:  delta del cliente (al.fuel_surc crudo; null = sin fila
 *                    propia, el motor usa +4% por defecto).
 *   - fuel_efectivo: lo que REALMENTE se cobra = servizio_fuel + delta,
 *                    con suelo en 0 (nunca negativo).
 */

/** Subconjunto de ServiceConfigRow relevante para el desglose de fuel. */
export interface FuelDisplayRow {
  servizio_fuel?: number;
  fuel_cliente?: number | null;
  fuel_efectivo?: number;
}

/** Delta por defecto que aplica el motor cuando el cliente no tiene fila propia. */
export const FUEL_CLIENTE_DEFAULT_DELTA = 4;

/**
 * Formatea un porcentaje SIN ocultar el 0 (a diferencia de fmtPct, usado para
 * servizio_fuel/fuel_surc en el resto de la fila). El 0 de fuel_efectivo es
 * el suelo aplicado -un dato real que el operador necesita ver-, no una
 * celda "sin datos".
 */
export function formatFuelEfectivo(v: unknown): string {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)} %` : '—';
}

/**
 * Partes numéricas (ya formateadas, con signo en el delta) del desglose
 * "servizio + delta cliente = efectivo", listas para interpolar en la clave
 * i18n `anagrafiche.listini.fuel_breakdown`.
 */
export interface FuelBreakdownParts {
  servizio: string;
  delta: string;
  efectivo: string;
}

export function fuelBreakdownParts(row: FuelDisplayRow): FuelBreakdownParts {
  const servizio = Number(row.servizio_fuel) || 0;
  const delta = row.fuel_cliente === null || row.fuel_cliente === undefined
    ? FUEL_CLIENTE_DEFAULT_DELTA
    : Number(row.fuel_cliente);
  const efectivo = Number(row.fuel_efectivo) || 0;
  const sign = delta >= 0 ? '+' : '';
  return {
    servizio: servizio.toFixed(2),
    delta: `${sign}${delta.toFixed(2)}`,
    efectivo: efectivo.toFixed(2),
  };
}
