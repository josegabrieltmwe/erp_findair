/**
 * El servidor rechaza los bultos nuevos con peso <= 0 (`validate_add_params`),
 * así que se comprueba antes de enviar nada. El peso llega ya en métrico.
 */
export function hasNewRowWithoutWeight<T extends { peso?: unknown }>(
  rows: readonly T[],
  isExisting: (row: T) => boolean,
): boolean {
  return rows.some((r) => !isExisting(r) && !(Number(r.peso) > 0));
}
