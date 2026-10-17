/**
 * Adaptador `ListSource` para datos YA cargados en memoria (client-side).
 *
 * Los listados principales del ERP (cargo, shipment, invoicing, anagrafiche…)
 * alimentan `ListingDataView` desde un store/servicio con paginación server-side.
 * Pero los sub-listados dentro de una ficha (contatti, sedi, banche… de una
 * anagrafica) reciben un array pequeño por prop y filtran/ordenan en memoria.
 *
 * Este composable envuelve un array reactivo (normalmente ya filtrado) en el
 * contrato `ListSource`, de modo que esos sub-listados puedan usar el MISMO
 * componente base `ListingDataView` que el resto del proyecto — heredando
 * sticky header, zebra, hover y el toggle paginado/scroll — sin red:
 *
 *   const source = useClientSideListSource(filteredRows);
 *   const mode = useListViewMode('tmwe:contatti-view-mode', 'paginated');
 *   <ListingDataView :source="source" :mode="mode" @update:mode="mode = $event" … />
 *
 * Soporta AMBOS modos de `ListingDataView`:
 *  - `infinite`: expone TODO el array como `rows` (todo cabe en una render;
 *    `loadMore` es no-op).
 *  - `paginated`: corta el array en memoria por `page`/`perPage`, de modo que
 *    el paginador de Vuetify funciona igual que con datos server-side.
 * `setSort` ordena en memoria; el consumidor puede ignorarlo dejando las
 * columnas `sortable: false`.
 */
import { computed, reactive, ref, unref, type MaybeRefOrGetter } from 'vue';
import type { ListSource } from './types';
import type { ListViewMode } from './useListViewMode';

export interface ClientSideListOptions {
  /** Orden inicial (clave UI). Vacío = sin orden. */
  initialSort?: string;
  initialSortDir?: 'ASC' | 'DESC';
  /** Tamaño de página inicial (modo paginado). Default 25. */
  initialPerPage?: number;
  /** Señal de carga externa (p. ej. mientras el padre trae el detalle). */
  loading?: MaybeRefOrGetter<boolean>;
  /**
   * Modo activo del ListingDataView (ref/getter). Determina la semántica de
   * `rows`: en 'paginated' es la ventana [page]; en 'infinite' es el acumulado
   * [0 .. page*perPage] que crece con loadMore. Requerido para que el toggle
   * paginado/scroll funcione bien; si se omite, se asume 'infinite'.
   */
  mode?: MaybeRefOrGetter<ListViewMode>;
}

/**
 * @param rowsSource Array de filas (ref, getter o array) ya filtrado por el
 *                   consumidor. Debe tener `id: number` en cada fila.
 */
export function useClientSideListSource<TRow extends { id: number }>(
  rowsSource: MaybeRefOrGetter<TRow[]>,
  options: ClientSideListOptions = {},
): ListSource<TRow> {
  const sort = ref(options.initialSort ?? '');
  const sortDir = ref<'ASC' | 'DESC'>(options.initialSortDir ?? 'ASC');
  const page = ref(1);
  const perPage = ref(options.initialPerPage ?? 25);

  const resolveRows = (): TRow[] =>
    typeof rowsSource === 'function' ? (rowsSource as () => TRow[])() : unref(rowsSource);

  const resolveLoading = (): boolean => {
    const l = options.loading;
    if (l == null) return false;
    return typeof l === 'function' ? (l as () => boolean)() : unref(l);
  };

  // Ordena en memoria por la clave activa. Comparación numérica si ambos lados
  // son números; textual (locale) en caso contrario. Sin `sort` → orden natural.
  const sortedRows = computed<TRow[]>(() => {
    const base = resolveRows();
    const key = sort.value;
    if (!key) return base;
    const dir = sortDir.value === 'ASC' ? 1 : -1;
    return [...base].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (av == null && bv == null) return 0;
      if (av == null) return -dir;
      if (bv == null) return dir;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  });

  const resolveMode = (): ListViewMode => {
    const m = options.mode;
    if (m == null) return 'infinite';
    return typeof m === 'function' ? (m as () => ListViewMode)() : unref(m);
  };

  // `rows` según el modo:
  //  - paginated: ventana de UNA página [start .. start+perPage] (v-data-table-server
  //    ya muestra el paginador y pide otra página vía @update:options→loadPage).
  //  - infinite: acumulado [0 .. page*perPage], que crece con loadMore al hacer
  //    scroll (mismo comportamiento que un feed server-side).
  const pagedRows = computed<TRow[]>(() => {
    const all = sortedRows.value;
    if (resolveMode() === 'paginated') {
      const start = (page.value - 1) * perPage.value;
      return all.slice(start, start + perPage.value);
    }
    return all.slice(0, page.value * perPage.value);
  });

  return reactive<ListSource<TRow>>({
    get total() { return sortedRows.value.length; },
    get rows() { return pagedRows.value; },
    get loading() { return resolveLoading(); },
    error: null,
    get page() { return page.value; },
    get perPage() { return perPage.value; },
    get sort() { return sort.value; },
    get sortDir() { return sortDir.value; },
    async loadPage(p: number) { page.value = p; },
    // En modo infinite ListingDataView llama loadMore para acumular; como todo
    // está en memoria, avanzamos la "página" para revelar el siguiente bloque.
    async loadMore() {
      if (page.value * perPage.value < sortedRows.value.length) page.value += 1;
    },
    async refresh() { page.value = 1; },
    setSort(s: string, dir: 'ASC' | 'DESC') { sort.value = s; sortDir.value = dir; page.value = 1; },
    setPerPage(n: number) { perPage.value = n; page.value = 1; },
  }) as ListSource<TRow>;
}
