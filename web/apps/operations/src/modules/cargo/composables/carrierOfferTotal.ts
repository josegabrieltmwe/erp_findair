/**
 * El total «ALL IN» de la cotización de una aerolínea (legado vttoff.php, `ReCalc()`), en la pantalla.
 *
 * Solo sirve para MOSTRAR el total mientras la aerolínea teclea: el que se guarda lo calcula el servidor con la misma fórmula
 * (tmwe_api · Cargo_Offer_Calculator) y los dos leen los mismos casos dorados (`carrierOfferTotal.vectors.json`, duplicado de
 * tmwe_api/tests/fixtures/carrier_offer_total_vectors.json: deben ser idénticos).
 *
 * Por línea: coste = costoV si no es 0, si no costo_unit (igual para el mínimo y el máximo); cantidad = 1 (`fix`), peso tasable
 * (`kg`), n.º de bultos (`box`), 0 si el tipo es desconocido; importe = coste × cantidad, subido al mínimo y bajado al máximo
 * cuando son > 0; un coste negativo cuenta 0. Redondeo canónico de los dos lados: `floor(x*100 + 0.5) / 100`.
 */

export interface ChargeAmounts {
  type?: string | null;
  costo_unit?: string | number | null;
  costo_min?: string | number | null;
  costo_max?: string | number | null;
  costo_unitV?: string | number | null;
  costo_minV?: string | number | null;
  costo_maxV?: string | number | null;
}

function num(value: unknown): number {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function round2(value: number): number {
  return Math.floor(value * 100 + 0.5) / 100;
}

export function lineAmount(line: ChargeAmounts, chargeableWeight: number, parcels: number): number {
  let cost = num(line.costo_unit);
  let min = num(line.costo_min);
  let max = num(line.costo_max);
  const costV = num(line.costo_unitV);
  const minV = num(line.costo_minV);
  const maxV = num(line.costo_maxV);
  if (costV !== 0) cost = costV;
  if (minV !== 0) min = minV;
  if (maxV !== 0) max = maxV;

  let qty = 0;
  if (line.type === "fix") qty = 1;
  else if (line.type === "kg") qty = chargeableWeight;
  else if (line.type === "box") qty = parcels;

  if (cost < 0) cost = 0;
  let amount = cost * qty;
  if (amount < min && min > 0) amount = min;
  if (amount > max && max > 0) amount = max;
  return round2(amount);
}

export function computeOfferTotal(charges: ChargeAmounts[], chargeableWeight: number, parcels: number): number {
  let sum = 0;
  for (const line of charges) sum += lineAmount(line, chargeableWeight, parcels);
  return round2(sum);
}
