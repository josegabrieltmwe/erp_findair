/**
 * Opciones de un filtro de listado (selects del panel de filtros) definidas
 * UNA sola vez: el panel las usa para pintar el select y la página del
 * listado para etiquetar el chip del filtro activo con el mismo texto. Antes
 * el chip mostraba el valor crudo («Controlada: S»).
 */
export interface FilterOptionDef {
  value: string;
  /** Clave i18n del texto de la opción. */
  key: string;
}

export type Translate = (key: string) => string;

/** Items para un v-select de Vuetify. */
export function toSelectItems(
  defs: readonly FilterOptionDef[],
  t: Translate,
): Array<{ title: string; value: string }> {
  return defs.map((d) => ({ title: t(d.key), value: d.value }));
}

/**
 * Texto de la opción cuyo valor es `value`; si el valor no está en la lista
 * (un valor llegado por URL que el panel no ofrece) se devuelve tal cual.
 */
export function filterOptionLabel(
  defs: readonly FilterOptionDef[] | undefined,
  value: string,
  t: Translate,
): string {
  const def = defs?.find((d) => d.value === value);
  return def ? t(def.key) : value;
}
