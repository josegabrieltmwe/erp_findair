/** Resumen de la aplicación masiva de riaddebito: recuento y suma de importes. */
export function summarizeRechargeBulk(
  rows: ReadonlyArray<{ id: number; postfatt?: number | string | null }>,
  ids: readonly number[],
): { count: number; total: number } {
  const selected = new Set(ids);
  let cents = 0;
  let count = 0;
  for (const r of rows) {
    if (!selected.has(r.id)) continue;
    count++;
    const v = Number(r.postfatt);
    if (Number.isFinite(v)) cents += Math.round(v * 100);
  }
  // Los ids seleccionados que ya no estén en la página cuentan como fila sin importe conocido.
  const missing = ids.filter((id) => !rows.some((r) => r.id === id)).length;
  return { count: count + missing, total: cents / 100 };
}
