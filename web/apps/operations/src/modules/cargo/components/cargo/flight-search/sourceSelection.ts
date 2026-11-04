/**
 * Seleccion en bloque de las fuentes de busqueda de vuelos (casilla "Todas").
 *
 * - Marcar: solo las fuentes disponibles y NO delegadas. Aceptar una fuente
 *   delegada autoriza cotizar con la cuenta de otro partner (`via_partner`),
 *   asi que se marca siempre a mano, una por una.
 * - Desmarcar: todas las disponibles, delegadas incluidas.
 * - Las no disponibles (sin credencial) no se tocan.
 */
export interface SourceState {
  flag: string;
  available: boolean;
  delegated: boolean;
}

/** Fuentes que la casilla "Todas" marca. */
export function bulkSelectableFlags(sources: SourceState[]): string[] {
  return sources.filter((s) => s.available && !s.delegated).map((s) => s.flag);
}

/** Estado de la casilla maestra a partir de lo marcado. */
export function selectAllState(
  sources: SourceState[],
  selected: Record<string, boolean | undefined>,
): { checked: boolean; indeterminate: boolean } {
  const bulk = bulkSelectableFlags(sources);
  const checked = bulk.length > 0 && bulk.every((f) => selected[f] === true);
  const some = sources.some((s) => selected[s.flag] === true);
  return { checked, indeterminate: some && !checked };
}

/** Nuevo valor de cada flag tras pulsar "Todas". */
export function applySelectAll(
  sources: SourceState[],
  on: boolean,
): Record<string, boolean> {
  const flags = on
    ? bulkSelectableFlags(sources)
    : sources.filter((s) => s.available).map((s) => s.flag);
  const out: Record<string, boolean> = {};
  for (const f of flags) out[f] = on;
  return out;
}
