import type { HomeKpiDescriptor } from "../dashboard/home_kpi_catalog";

/**
 * Colas de trabajo de un listado, derivadas del catálogo único de la home (`HOME_KPI_CATALOG`): la
 * tarjeta de «Da fare oggi», el KPI de la home y el selector de colas del listado leen de la misma
 * fuente, así que un número y la lista que abre no pueden divergir.
 *
 * Solo entran las colas que el servidor filtra de verdad (`serverFiltered`): la regla del legado es
 * «nunca abrir una lista que no corresponde al número».
 */
export interface QueueItem {
  /** Valor de `type=` que entiende el API. */
  key: string;
  icon: string;
  label: string;
}

export interface QueueGroup {
  /** Sección del catálogo (`operations_in`, `operations_out`, …). */
  section: string;
  items: QueueItem[];
}

const SECTION_ORDER = ["operations_in", "operations_out"] as const;

export function queuesForPage(
  catalog: readonly HomeKpiDescriptor[],
  page: HomeKpiDescriptor["link"]["page"],
): QueueGroup[] {
  const bySection = new Map<string, QueueItem[]>();
  for (const k of catalog) {
    const type = k.link.query.type;
    if (k.link.page !== page || !k.serverFiltered || !type) continue;
    const list = bySection.get(k.section) ?? [];
    if (!list.some((i) => i.key === type)) {
      list.push({ key: type, icon: k.icon, label: k.label });
    }
    bySection.set(k.section, list);
  }
  const rank = (s: string): number => {
    const i = (SECTION_ORDER as readonly string[]).indexOf(s);
    return i === -1 ? SECTION_ORDER.length : i;
  };
  return [...bySection.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([section, items]) => ({ section, items }));
}
