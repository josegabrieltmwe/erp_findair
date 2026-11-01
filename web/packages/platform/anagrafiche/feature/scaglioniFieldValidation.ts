/**
 * Validación de los campos numéricos de escalón/seguro antes de guardarlos.
 * Prefijos del API: kg = peso, fx = margen fijo, pr = margen %, ass_min = seguro
 * mínimo, ass_perc = seguro %.
 */
export type NumericFieldKind = 'percent' | 'nonNegative';

/** Porcentajes (pr*, ass_perc) 0-100; resto (kg*, fx*, ass_min) >= 0. */
export function fieldKind(field: string): NumericFieldKind {
  return field.startsWith('pr') || field === 'ass_perc' ? 'percent' : 'nonNegative';
}

export type ParsedField = { ok: true; value: number } | { ok: false };

/** Texto vacío, no numérico o fuera de rango => no se envía. */
export function parseTierValue(raw: unknown, kind: NumericFieldKind): ParsedField {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (text === '') return { ok: false };
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  if (kind === 'percent' && n > 100) return { ok: false };
  return { ok: true, value: n };
}
