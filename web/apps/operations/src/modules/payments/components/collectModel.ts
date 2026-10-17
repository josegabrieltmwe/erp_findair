/** Lógica pura del diálogo de cobro (validación de importes parciales). */

export type AmountError = "required" | "not_positive" | "exceeds" | null;

const EPS = 0.005;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Valida el importe de un cobro parcial: obligatorio, mayor que cero y menor
 * que el importe pendiente de la cuota (igual o mayor sería un cobro total).
 */
export function validatePartialAmount(
  amount: number | null | undefined,
  total: number,
): AmountError {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "required";
  }
  if (Number(amount) <= 0) return "not_positive";
  if (Number(amount) >= total - EPS) return "exceeds";
  return null;
}

/** Importe que queda por cobrar tras un cobro parcial. */
export function remainderOf(
  amount: number | null | undefined,
  total: number,
): number {
  const a = Number(amount ?? 0);
  if (!Number.isFinite(a) || a <= 0 || a >= total) return 0;
  return round2(total - a);
}
