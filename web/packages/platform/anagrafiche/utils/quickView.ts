/**
 * Vista rápida del listado de anagrafiche: preset de FILTROS (tipo/bloccato),
 * no de columnas. No usa el contrato compartido `ListingWorkView` —su
 * `headersForWorkView` solo decide qué columnas se muestran, y forzarlo aquí
 * habría sido reutilizar el tipo para algo que no fue diseñado a hacer.
 *
 * El legacy (anagr_list.php) llama "Customers" a `tipo='C'`; un operario que
 * viene de allí espera entrar al listado viendo solo eso, no las ~25% de
 * filas de `anagrafiche` que no son clientes (partners, proveedores,
 * corrieri, internos, archivados).
 */

export type QuickViewId = 'all' | 'clients' | 'blocked';

export interface QuickViewFilters {
  tipo: string | null;
  bloccato: string | null;
}

/**
 * Resuelve la vista activa a partir del estado real de filtros, en vez de un
 * ref propio: si el operario cambia `tipo`/`bloccato` por otra vía (panel
 * avanzado, chip, click-to-filter) el selector debe reflejar eso, no quedar
 * desincronizado mostrando la última vista elegida explícitamente.
 *
 * 'all' se resuelve por exclusión (no es 'clients' ni 'blocked'), no por un
 * id con significado propio — así una vista nueva no tiene que dejar de "ser"
 * una lista creciente de las demás.
 */
export function resolveActiveQuickView(filters: QuickViewFilters): QuickViewId {
  if (filters.tipo === 'C' && !filters.bloccato) return 'clients';
  if (filters.bloccato === 'S' && !filters.tipo) return 'blocked';
  return 'all';
}

/** Filtros a aplicar para una vista dada. */
export function filtersForQuickView(id: QuickViewId): QuickViewFilters {
  if (id === 'clients') return { tipo: 'C', bloccato: null };
  if (id === 'blocked') return { tipo: null, bloccato: 'S' };
  return { tipo: null, bloccato: null };
}
