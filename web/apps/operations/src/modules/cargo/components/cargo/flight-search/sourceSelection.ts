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

/**
 * Fuentes que se ofrecen en el formulario.
 *
 * El servidor puede omitir una fuente que este usuario no puede pedir: hoy
 * `realtime_direct` (la cuenta directa de TMWE IT), que a un partner real ya no
 * se le devuelve. Si la lista del servidor ha llegado y no trae una fuente, esa
 * fuente no se muestra (y no se envia). Sin lista —sin ruta todavia o fallo de
 * la consulta— se ofrecen todas, como antes.
 */
export function offeredFlags<F extends string>(
  flags: readonly F[],
  serverKeyOf: (flag: F) => string | undefined,
  serverKeys: readonly string[],
): F[] {
  if (serverKeys.length === 0) return [...flags];
  return flags.filter((f) => {
    const key = serverKeyOf(f);
    return key !== undefined && serverKeys.includes(key);
  });
}
