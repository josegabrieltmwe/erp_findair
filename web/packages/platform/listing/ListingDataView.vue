<template>
  <!--
    Use `<section>` instead of `<v-card>` so the .card-tmwe shadow+border
    rules from mockup2.scss (scoped to .v-theme--shipmentV2Light /
    .v-theme--tmweShipment) apply with the expected specificity. Vuetify's
    v-card injects its own elevation system that would override the v2 look.
  -->
  <section class="card-tmwe sdv-card">
    <!--
      Reload overlay — covers the table with a dimmed scrim + centred
      spinner whenever the whole list is being replaced (sort, filter,
      page change). NOT shown for infinite-scroll appends (`pumping`),
      where new rows arrive below the fold and an overlay would hide the
      rows the operator is already reading. `transition` fades it so a
      fast reply doesn't flash.
    -->
    <transition name="sdv-overlay-fade">
      <div v-if="showReloadOverlay" class="sdv-reload-overlay" aria-live="polite">
        <div class="sdv-reload-box">
          <v-progress-circular indeterminate size="32" width="3" color="primary" />
          <span class="sdv-reload-label">{{ t('platform.loading') }}</span>
        </div>
      </div>
    </transition>

    <!--
      Bulk-actions bar — appears ONLY when at least one row is selected.
      Replaces the previous always-on `.sdv-cardh` summary band (which
      duplicated info already shown in the dashboard topbar) with a
      contextual selection bar that pops up only when needed.
    -->
    <div v-if="selectedIds.length > 0" class="cardh sdv-cardh sdv-cardh--selecting">
      <v-icon icon="mdi-check-circle" size="16" color="primary" />
      <h3 class="cardh-title">{{ t('platform.selected', selectedIds.length) }}</h3>
      <span class="cardh-spacer" />
      <slot name="bulk-actions" :selected-ids="selectedIds" :clear="clearSelection" />
      <button
        type="button"
        class="cardh-edit"
        :title="t('platform.clear_selection')"
        @click="clearSelection"
      >
        <v-icon icon="mdi-close" size="14" />
      </button>
    </div>

    <!-- ============================================================
         Table body — paginated mode uses v-data-table-server for its
         built-in footer (pagination controls, per-page select). The
         outer styling is normalized via `.sdv-table-wrap` so it
         matches the infinite-mode look (same hover, same padding,
         same border-color tokens).
    ============================================================ -->
    <div v-if="modeProxy === 'paginated'" class="sdv-table-wrap">
      <v-data-table-server
        v-model="selectedProxy"
        :items-per-page="source.perPage"
        :page="source.page"
        :sort-by="vuetifySortBy"
        :headers="normalizedHeaders"
        :items="source.rows"
        :items-length="source.total"
        :loading="source.loading"
        :items-per-page-options="[10, 25, 50, 100]"
        :must-sort="true"
        density="comfortable"
        hover
        :show-select="selectable"
        return-object
        item-value="id"
        :value-comparator="sameRow"
        class="sdv-paginated"
        @update:options="onTableUpdate"
        @click:row="onRowClick"
      >
        <template
          v-for="header in normalizedHeaders"
          :key="header.key"
          #[`item.${header.key}`]="slotProps"
        >
          <span
            :class="{ 'sdv-cell-filterable': header.filterable }"
            @click="onCellClick($event, header, slotProps.item)"
          ><slot :name="`cell.${header.key}`" v-bind="slotProps" /></span>
        </template>
      </v-data-table-server>
    </div>

    <!-- INFINITE MODE -->
    <div v-else ref="scrollContainer" class="sdv-table-wrap sdv-virtual">
      <table class="sdv-table">
        <thead>
          <tr>
            <th v-for="header in normalizedHeaders" :key="header.key" :style="headerStyle(header)">
              <span
                v-if="header.sortable !== false"
                class="sdv-th-sortable"
                @click="onHeaderClickInfinite(header.key)"
              >
                {{ header.title }}
                <v-icon
                  v-if="sortKeyForUi === header.key"
                  :icon="source.sortDir === 'ASC' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                  size="13"
                />
              </span>
              <span v-else>{{ header.title }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in source.rows"
            :key="keyOf(row, idx)"
            :data-row-id="(row as IdentifiedRow).id"
            class="sdv-tr"
            :class="{ 'sdv-tr--active': String(keyOf(row, idx)) === String(activeRowId ?? '') }"
            role="button"
            tabindex="0"
            :aria-label="t('platform.open_record')"
            @click="onRowClick(undefined as unknown as Event, { item: row })"
            @keydown="onRowKeydown($event, row)"
          >
            <td
              v-for="header in normalizedHeaders"
              :key="header.key"
              :style="cellStyle(header)"
              :class="{ 'sdv-cell-filterable': header.filterable, 'sdv-cell-numeric': header.align === 'end' }"
              @click="onCellClick($event, header, row)"
            >
              <slot
                :name="`cell.${header.key}`"
                :item="row"
                :index="idx"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Sentinel for IntersectionObserver -->
      <div ref="sentinel" class="sdv-sentinel">
        <v-progress-circular
          v-if="source.loading"
          indeterminate
          size="18"
          width="2"
          color="primary"
        />
        <span v-else-if="source.rows.length >= source.total" class="sdv-sentinel-end">
          {{ source.total > 0 ? t('platform.end_of_list') : '' }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  ListSource,
  DataTableHeader,
  DataTableSortBy,
  ListingCellClick,
} from './types';
import type { ListViewMode } from './useListViewMode';

const { t } = useI18n();

type IdentifiedRow = { id: number };

const props = withDefaults(
  defineProps<{
    source: ListSource<IdentifiedRow>;
    headers: DataTableHeader[];
    selected: IdentifiedRow[];
    mode: ListViewMode;
    sortKeyMap: Record<string, string>;
    /**
     * Muestra la columna de selección (checkbox) para acciones bulk.
     * Por defecto `true` (cargo/shipment la usan); los listados sin acciones
     * masivas (p. ej. facturas) la desactivan para no mostrar un control inerte.
     */
    selectable?: boolean;
    /**
     * Identidad de fila para el `:key` del v-for. OPCIONAL: sin ella se sigue
     * usando `row.id`, asi que los 25 consumidores actuales no cambian.
     *
     * Existe porque `id` no siempre ES la identidad. En el buscador de vuelos
     * las tarifas llegan por SSE y se re-normalizan, de modo que `id` era un
     * correlativo de render que cambiaba solo: Vue destruia y recreaba filas
     * que en realidad eran las mismas. La clave natural del dominio
     * (short_id / rate_id) es estable, y con ella la fila se MUEVE en el DOM
     * en vez de recrearse.
     *
     * Acepta el nombre de un campo (`"_rowKey"`) o una funcion.
     */
    rowKey?: string | ((row: Record<string, unknown>) => string | number);
    /** Row currently shown in a side drawer. */
    activeRowId?: string | number | null;
  }>(),
  { selectable: true, rowKey: undefined, activeRowId: null },
);

/**
 * Resuelve el `:key` de una fila: `rowKey` si se indico, `id` si no, y el
 * indice como ultimo recurso.
 */
function keyOf(row: unknown, idx: number): string | number {
  const r = row as Record<string, unknown>;
  const rk = props.rowKey;
  if (typeof rk === 'function') {
    return rk(r);
  }
  if (typeof rk === 'string') {
    const v = r[rk];
    if (typeof v === 'string' || typeof v === 'number') {
      return v;
    }
  }
  const id = (row as IdentifiedRow | null)?.id;
  return id ?? idx;
}

const emit = defineEmits<{
  (e: 'update:selected', v: IdentifiedRow[]): void;
  (e: 'update:mode', v: ListViewMode): void;
  (e: 'row-click', row: IdentifiedRow): void;
  (e: 'cell-click', payload: ListingCellClick<IdentifiedRow>): void;
}>();

const numericHeaderPattern = /(?:€|\b(?:kg|peso|weight|costo|cost|prezzo|price|importo|amount|totale|total)\b)/i;
const normalizedHeaders = computed<DataTableHeader[]>(() => props.headers.map((header) => ({
  ...header,
  align: header.align ?? (header.numeric || numericHeaderPattern.test(`${header.key} ${header.title}`) ? 'end' : undefined),
})));

function valueAt(row: IdentifiedRow, path: string): unknown {
  return path.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, row);
}

function onCellClick(event: MouseEvent, header: DataTableHeader, row: IdentifiedRow): void {
  if (!header.filterable) return;
  const target = event.target as HTMLElement | null;
  // La busqueda de controles interactivos se ACOTA A LA CELDA (`currentTarget`,
  // el <td>). Un `closest()` sin acotar subia hasta el <tr>: en modo infinito
  // la fila lleva role="button" para poder abrirse con teclado (ver plantilla),
  // asi que la condicion se cumplia SIEMPRE y esta funcion salia antes de
  // emitir `cell-click` y antes de `stopPropagation()`. Efecto: el filtro por
  // clic no funcionaba, y el clic en celda burbujeaba ademas a la fila.
  // `currentTarget` es el <td> en modo infinito y un <span> interior en modo
  // paginado; en ambos casos la celda real es su <td> mas cercano.
  const cell = (event.currentTarget as HTMLElement | null)?.closest('td') ?? null;
  const interactive = target?.closest('button, a, input, select, textarea, [role="button"]');
  if (interactive && cell?.contains(interactive)) return;
  event.stopPropagation();
  emit('cell-click', {
    field: header.filterField ?? header.key,
    value: valueAt(row, header.key),
    label: header.title,
    row,
  });
}

const selectedProxy = computed<IdentifiedRow[]>({
  get: () => props.selected,
  set: (v) => emit('update:selected', v),
});

const modeProxy = computed<ListViewMode>({
  get: () => props.mode,
  set: (v) => emit('update:mode', v),
});

const selectedIds = computed<number[]>(() => props.selected.map((r) => r.id));

/**
 * Comparador de selección por `id` (no por referencia). Con `return-object`
 * Vuetify compara los objetos del v-model contra las filas por identidad; como
 * cada fetch crea objetos nuevos, el checkbox "seleccionar todo" marcaba pero
 * NO reconocía que ya estaban todos seleccionados → no deseleccionaba. Comparar
 * por id lo arregla (funciona igual para filas y para el toggle de cabecera).
 */
function sameRow(a: unknown, b: unknown): boolean {
  const ida = (a as IdentifiedRow | null)?.id;
  const idb = (b as IdentifiedRow | null)?.id;
  return ida != null && ida === idb;
}

function clearSelection(): void {
  emit('update:selected', []);
}

/**
 * Show the dimming reload overlay when the whole list is being replaced
 * (sort, filter, page change) — NOT for infinite-scroll appends, where
 * `pumping` is true and the existing rows must stay readable. The empty /
 * skeleton states (rows.length === 0) own the initial load, so we only
 * cover an *existing* list being refreshed.
 */
const showReloadOverlay = computed<boolean>(
  () => props.source.loading && !pumping.value && props.source.rows.length > 0,
);

const summaryText = computed<string>(() => {
  const total = props.source.total.toLocaleString('en-US');
  if (props.mode === 'paginated') {
    // Pluralised: "1 shipment" / "N shipments".
    return t('platform.summary.count', { count: total }, props.source.total);
  }
  const loaded = props.source.rows.length.toLocaleString('en-US');
  return t('platform.summary.loaded_of', { loaded, total });
});

const backendToUi = computed<Record<string, string>>(() =>
  Object.fromEntries(Object.entries(props.sortKeyMap).map(([k, v]) => [v, k])),
);

const sortKeyForUi = computed<string | undefined>(() => backendToUi.value[props.source.sort]);

const vuetifySortBy = computed<DataTableSortBy[]>(() => {
  const uiKey = sortKeyForUi.value;
  if (!uiKey) return [];
  return [{ key: uiKey, order: props.source.sortDir === 'ASC' ? 'asc' : 'desc' }];
});

function onHeaderClickInfinite(uiKey: string): void {
  const backendField = props.sortKeyMap[uiKey];
  if (!backendField) return;
  let dir: 'ASC' | 'DESC' = 'DESC';
  if (props.source.sort === backendField) {
    dir = props.source.sortDir === 'ASC' ? 'DESC' : 'ASC';
  }
  props.source.setSort(backendField, dir);
  void props.source.refresh();
}

interface TableOptions {
  page: number;
  itemsPerPage: number;
  sortBy?: DataTableSortBy[];
}

function onTableUpdate({ page, itemsPerPage, sortBy }: TableOptions): void {
  let sortChanged = false;
  if (sortBy && sortBy.length > 0) {
    const backendField = props.sortKeyMap[sortBy[0].key];
    if (backendField) {
      const dir: 'ASC' | 'DESC' = sortBy[0].order === 'asc' ? 'ASC' : 'DESC';
      if (backendField !== props.source.sort || dir !== props.source.sortDir) {
        props.source.setSort(backendField, dir);
        sortChanged = true;
      }
    }
  }
  if (itemsPerPage !== props.source.perPage) {
    props.source.setPerPage(itemsPerPage);
    void props.source.refresh();
    return;
  }
  if (sortChanged) {
    void props.source.refresh();
    return;
  }
  if (page !== props.source.page) {
    void props.source.loadPage(page);
  }
}

function onRowClick(_: unknown, ctx: { item: IdentifiedRow }): void {
  emit('row-click', ctx.item);
}

/**
 * Keyboard activation for the clickable row (Enter/Space), matching @click.
 * Only fires when the row itself has focus — not when a nested control
 * (checkbox, button, link inside a cell) handles the key, so Space on a
 * selection checkbox toggles it without also opening the record.
 */
function onRowKeydown(e: KeyboardEvent, row: IdentifiedRow): void {
  if (e.target !== e.currentTarget) return;
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    onRowClick(undefined as unknown as Event, { item: row });
  }
}

/* -------------------------------------------------- infinite scroll
 * IntersectionObserver only fires on a *transition* into view. After a
 * loadMore() the sentinel often stays inside the 200px rootMargin (tall
 * viewport, short page), so it never re-crosses and the list stalls.
 *
 * Fix: the observer just records whether the sentinel is visible; a
 * `pump()` loop does the actual fetching and keeps going — awaiting each
 * loadMore and re-checking visibility — until the sentinel is no longer
 * in view or the list is exhausted. A single in-flight guard prevents
 * overlapping pumps. */
const scrollContainer = ref<HTMLDivElement | null>(null);
const sentinel = ref<HTMLDivElement | null>(null);
let observer: IntersectionObserver | null = null;
// Reactive so the reload overlay can tell an infinite-scroll append
// (pumping) apart from a full reload (sort/filter/page).
const pumping = ref(false);
/**
 * Generation token. Bumped whenever the dataset is replaced from page 1
 * (filter/sort/refresh — detected as `rows.length` shrinking or `page`
 * resetting). A pump captures the current generation and bails the moment
 * it changes, so a loadMore() queued mid-scroll can't fire with the *new*
 * filters but the *old* page number (the cause of the aborted
 * `page=3&…&terminal_part=MXP` request).
 */
let generation = 0;
let lastRowCount = 0;
watch(
  () => [props.source.page, props.source.rows.length] as const,
  ([page, count]) => {
    // A reset to page 1 OR a shrink in row count means the list was
    // replaced (filter/sort change). Invalidate any in-flight pump.
    if (page === 1 && count <= lastRowCount) generation += 1;
    lastRowCount = count;
  },
);

function exhausted(): boolean {
  return props.source.rows.length >= props.source.total;
}

/**
 * True when the sentinel is within `margin` px of the scroll container's
 * bottom edge. Measured directly (not via the async observer flag) so the
 * pump loop can re-check immediately after appending rows.
 */
function sentinelInView(margin = 200): boolean {
  const el = sentinel.value;
  const root = scrollContainer.value;
  if (!el || !root) return false;
  const elRect = el.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  return elRect.top <= rootRect.bottom + margin;
}

async function pump(): Promise<void> {
  if (pumping.value) return;
  pumping.value = true;
  const myGen = generation;
  try {
    // Keep loading while the sentinel is near the bottom and there's more
    // to fetch. Re-measures the geometry each iteration so a tall viewport
    // (sentinel never leaves the rootMargin) doesn't stall the list.
    while (
      generation === myGen &&        // a filter/sort reset cancels this pump
      sentinelInView() &&
      !exhausted() &&
      !props.source.loading
    ) {
      const before = props.source.rows.length;
      await props.source.loadMore();
      // If the dataset was replaced mid-fetch (filter changed), stop —
      // the appended rows belong to a stale page.
      if (generation !== myGen) break;
      // Guard against a no-op response (no growth) so we never spin.
      if (props.source.rows.length <= before) break;
      // Let the DOM paint the appended rows before re-measuring.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
  } finally {
    pumping.value = false;
  }
}

function setupObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (!sentinel.value || props.mode !== 'infinite') return;
  observer = new IntersectionObserver(
    (entries) => {
      // Any intersection kicks the pump; pump() then self-drives by
      // re-measuring until the sentinel clears the viewport.
      if (entries.some((e) => e.isIntersecting)) void pump();
    },
    { root: scrollContainer.value, rootMargin: '200px', threshold: 0 },
  );
  observer.observe(sentinel.value);
}

watch(() => props.mode, (m) => {
  if (m === 'infinite') {
    void props.source.refresh();
    void Promise.resolve().then(() => setupObserver());
  } else {
    if (observer) { observer.disconnect(); observer = null; }
  }
});

// When a fresh page lands (total/rows settle) and we're in infinite mode,
// the IntersectionObserver won't re-fire on its own if the sentinel was
// already in view before the data arrived (e.g. first load, or a filter
// change that returns a short page). Nudge the pump so a short first page
// that doesn't fill the viewport keeps loading.
watch(
  () => [props.source.total, props.source.rows.length, props.source.loading] as const,
  () => {
    if (props.mode !== 'infinite') return;
    if (props.source.loading) return;
    if (sentinelInView()) void pump();
  },
);

onMounted(() => setupObserver());
onBeforeUnmount(() => observer?.disconnect());

function headerStyle(h: DataTableHeader): Record<string, string> {
  const s: Record<string, string> = {};
  if (h.width) s.width = `${h.width}px`;
  if (h.align) s.textAlign = h.align;
  return s;
}

function cellStyle(h: DataTableHeader): Record<string, string> {
  return h.align ? { textAlign: h.align } : {};
}
</script>

<style scoped lang="scss">
/* ============================================================
   Card-wide overrides — the parent `.card-tmwe` already applies
   bg, border-radius, padding and (light theme only) shadow. We
   only add the bits specific to this listing view.
============================================================ */
.sdv-card {
  /* Remove the default `padding: 0 14px 13px` from `.card-tmwe` so
     the table can hug the card edges. The header band re-establishes
     the inner gutter via its own padding. */
  padding: 0;
  /* Ocupar TODO el alto restante del .dsh-main (que es flex column con
     min-height:0). La card crece para llenar el viewport y la tabla hace
     scroll interno, en vez de que la card mida solo lo que mide su contenido. */
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* Anchor for the absolutely-positioned reload overlay. */
  position: relative;
}

/* ============================================================
   Reload overlay — dims the table and centres a spinner while the
   whole list is being replaced (sort / filter / page change). Sits
   above the table (z-index over the sticky header's z-index: 5) but
   below modals.
============================================================ */
.sdv-reload-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  /* The spinner box is centred against the *viewport* (position: fixed),
     so we don't flex-centre here — that would centre against the full card
     height and the box could land off-screen on a tall, scrolled list. */
  /* Semi-opaque scrim tinted to the surface so light/dark both read well. */
  background: rgba(var(--v-theme-surface), 0.6);
  backdrop-filter: blur(1.5px);
  border-radius: inherit;
  cursor: progress;
}

.sdv-reload-box {
  /* Pin to the centre of the visible viewport, not the (possibly very
     tall) card — the spinner stays in view no matter how far the list is
     scrolled. translate(-50%, -50%) re-centres on the box's own size. */
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 22px;
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
  box-shadow:
    0 4px 12px -2px rgba(15, 23, 42, 0.22),
    0 2px 4px rgba(15, 23, 42, 0.12);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.sdv-reload-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Fade the overlay in/out so a quick response doesn't flash a hard cut. */
.sdv-overlay-fade-enter-active,
.sdv-overlay-fade-leave-active {
  transition: opacity 0.18s ease;
}
.sdv-overlay-fade-enter-from,
.sdv-overlay-fade-leave-to {
  opacity: 0;
}

/* ============================================================
   Card header band — mirrors `.cardh` (CardHeader.vue) but with
   margin 0 to hit the (now zero) card padding, and a slightly
   different layout because there is no icon-button gap.
============================================================ */
.sdv-cardh {
  margin: 0;
  /* Match the cardh look but with the card's top border-radius. */
  border-radius: 14px 14px 0 0;
}

.sdv-cardh--selecting {
  background: rgba(var(--v-theme-primary), 0.08);
}

/* Note: `.sdv-mode-toggle` and `.sdv-mode-btn` are defined globally in
   mockup2.scss so the ViewModeToggle component can be rendered anywhere
   (currently in the dashboard topbar). */

/* ============================================================
   Table wrapper — shared shell for both modes so the visual
   rhythm is identical between paginated and infinite views.
============================================================ */
.sdv-table-wrap {
  position: relative;
  /* Crece dentro de la .sdv-card (flex column). NO scrollea él mismo: el
     scroll lo maneja el hijo (`.v-table__wrapper` en paginated vía
     :deep(.sdv-paginated), o este mismo wrapper cuando lleva `.sdv-virtual`
     en modo infinito). Así evitamos doble barra de scroll. */
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sdv-cell-filterable {
  cursor: pointer;
}

span.sdv-cell-filterable {
  display: block;
  min-height: 20px;
}

.sdv-cell-filterable:hover {
  color: rgb(var(--v-theme-primary));
}

.sdv-cell-numeric,
:deep(td.v-data-table__td--align-end) {
  font-variant-numeric: tabular-nums;
}

.sdv-tr--active,
:deep(tbody tr.sdv-tr--active) {
  background: rgba(var(--v-theme-primary), .13) !important;
  box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary));
}

.sdv-virtual {
  /* Modo infinito: este wrapper ES el contenedor scrolleable (la <table>
     plana vive dentro). Antes usaba max-height fija `calc(100vh - 320px)`;
     ahora hereda el alto del flex padre y scrollea aquí. */
  overflow-y: auto;
}

/* Paginated mode: align Vuetify table to our minimal theme. The
   overrides intentionally target the wrapper class only — they
   never leak to other v-data-tables elsewhere in the app. */
:deep(.sdv-paginated) {
  background: transparent;
  font-family: inherit;
  font-size: 13px;

  /* Llenar la .sdv-table-wrap (flex). La v-data-table se vuelve flex column:
     el wrapper de filas crece+scrollea (con thead pegado arriba) y el footer
     de paginación queda fijo abajo. Así la card cubre todo el alto vertical. */
  height: 100%;
  display: flex;
  flex-direction: column;

  .v-table__wrapper {
    background: transparent;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  /* thead pegado arriba mientras el cuerpo scrollea. z-index alto para
     ganar a las filas con :hover (que crean stacking context vía
     transform + z-index:1) — sin esto, una fila hover cerca del top se
     pinta por encima del header sticky. */
  thead th {
    position: sticky;
    top: 0;
    z-index: 5;
  }

  .v-data-table__table,
  .v-table__wrapper > table {
    height: auto;
  }

  /* Header band — slightly raised off the body with a soft depth shadow
     so it reads as a fixed "shelf" floating above the scrolling rows
     (subtle-3D language, no transforms). The gradient adds a faint top
     light that sells the elevation. */
  thead th {
    background: linear-gradient(
      180deg,
      rgb(var(--v-theme-surface)) 0%,
      rgba(var(--v-theme-surface-variant), 0.55) 100%
    ) !important;
    color: rgb(var(--v-theme-on-surface-variant)) !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    letter-spacing: .06em;
    height: 40px !important;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
    box-shadow: 0 3px 6px -2px rgba(15, 23, 42, 0.14);
  }

  tbody tr {
    /* Animate the lift + shadow on hover. `position: relative` lets the
       hovered row's box-shadow paint above its neighbours. */
    position: relative;
    transition: background-color .12s ease, box-shadow .14s ease, transform .14s ease;
  }

  /* ── Zebra striping ──────────────────────────────────────────────
     Even rows get a tint so the eye can track a record straight across
     many columns. `on-surface` auto-adapts per theme (oscurece en claro,
     aclara en oscuro). 4.5% en claro es visible sin sentirse rayado; en
     dark mode se sube un punto (5.5%) porque el contraste percibido es
     menor sobre fondos oscuros. Odd rows stay on the base surface. */
  tbody tr:nth-child(even) {
    background: rgba(var(--v-theme-on-surface), var(--sdv-zebra, .045)) !important;
  }
  tbody tr:nth-child(odd) {
    background: rgb(var(--v-theme-surface)) !important;
  }

  /* Hover wins over zebra: tint + a gentle 3D lift (raise 1px, drop a
     soft shadow, hairline primary accent on the left edge). */
  tbody tr:hover {
    background: rgba(var(--v-theme-primary), .08) !important;
    transform: translateY(-1px);
    box-shadow:
      0 2px 6px -1px rgba(15, 23, 42, 0.16),
      inset 3px 0 0 0 rgb(var(--v-theme-primary));
    z-index: 1;
  }

  tbody td {
    border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6)) !important;
    height: auto !important;
    padding-top: 10px !important;
    padding-bottom: 10px !important;
  }

  /* Hide the row-selection column header in dark mode where the
     checkbox would otherwise look heavy. We keep the checkbox
     itself — only soften the visual weight. */
  .v-data-table__td--select-row,
  .v-data-table__th--select-row {
    width: 44px;
  }

  /* Footer (pagination controls) — slimmer, less Material-like.
     Alineación explícita: Vuetify no siempre centra los tres bloques
     (items-per-page / info / pagination) cuando el componente vive fuera
     de su layout de tabla habitual (p. ej. embebido en /clients). Sin
     `align-items: center` el v-select outlined —más alto— desalinea el
     resto y el footer no respeta su altura. */
  .v-data-table-footer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    padding: 6px 12px;
    min-height: 48px;
    font-size: 12px;
  }

  /* El "info" ocupa el centro; empuja la paginación al extremo derecho. */
  .v-data-table-footer__info {
    margin-inline-start: auto;
  }

  /* Select de items-per-page.
     Problema: dentro del footer (contenedor flex) el .v-input se estira a la
     altura de la fila (align-items:stretch por defecto en su cadena) y el
     campo outlined queda enorme y pegado al borde inferior. Fijamos un alto
     compacto explícito y evitamos que el input crezca (align-self:center).
     Usamos !important porque las reglas de densidad de Vuetify van con alta
     especificidad y variables propias (--v-field-input-min-height). */
  .v-data-table-footer__items-per-page {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .v-data-table-footer__items-per-page .v-input {
    align-self: center;
    flex: 0 0 auto;
  }
  .v-data-table-footer__items-per-page .v-input,
  .v-data-table-footer__items-per-page .v-input__control,
  .v-data-table-footer__items-per-page .v-field {
    min-height: 34px !important;
    max-height: 34px !important;
  }
  .v-data-table-footer__items-per-page .v-field {
    --v-input-control-height: 34px;
    --v-field-input-min-height: 34px;
    --v-field-padding-top: 0;
    --v-field-padding-bottom: 0;
    align-items: center;
  }
  .v-data-table-footer__items-per-page .v-field__input {
    min-height: 34px !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    align-items: center;
  }

  /* Botones de paginación: densidad compacta y centrados, para que no
     estiren el footer con su tamaño "comfortable" por defecto. */
  .v-data-table-footer__pagination .v-pagination__list {
    align-items: center;
  }
  .v-data-table-footer__pagination .v-btn {
    width: 28px;
    height: 28px;
  }
}

/* ============================================================
   Virtual-list (infinite mode) — built on a plain <table> so we
   can match the paginated look exactly without fighting Vuetify
   internals. Tokens match the .sdv-paginated overrides above.
============================================================ */
.sdv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.sdv-table thead tr {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.sdv-table th {
  /* Sticky is applied to the <th> cells (NOT <thead>) because with
     `border-collapse: collapse` a sticky <thead>/<tr> is ignored by
     Chrome/Safari — only sticky cells stay pinned. High z-index so the
     header wins over :hover rows (transform + z-index:1 stacking ctx). */
  position: sticky;
  top: 0;
  z-index: 5;
  text-align: left;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 11px 16px;
  white-space: nowrap;
  user-select: none;
  height: 40px;
  /* Background + depth shadow move to the cells so the pinned header
     stays opaque over the scrolling rows. */
  background: linear-gradient(
    180deg,
    rgb(var(--v-theme-surface)) 0%,
    rgba(var(--v-theme-surface-variant), 0.55) 100%
  );
  box-shadow: 0 3px 6px -2px rgba(15, 23, 42, 0.14);
}

.sdv-th-sortable {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color .12s;
}

.sdv-th-sortable:hover {
  color: rgb(var(--v-theme-primary));
}

.sdv-tr {
  cursor: pointer;
  position: relative;
  transition: background-color .12s ease, box-shadow .14s ease, transform .14s ease;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6));
}

/* ── Zebra striping (infinite mode) ── matches the paginated look (4.5%). */
.sdv-tr:nth-child(even) {
  background: rgba(var(--v-theme-on-surface), var(--sdv-zebra, .045));
}
.sdv-tr:nth-child(odd) {
  background: rgb(var(--v-theme-surface));
}

/* Hover: tint + subtle 3D lift + primary edge accent (same language as
   the paginated table so both view modes feel identical). */
.sdv-tr:hover {
  background: rgba(var(--v-theme-primary), .08);
  transform: translateY(-1px);
  box-shadow:
    0 2px 6px -1px rgba(15, 23, 42, 0.16),
    inset 3px 0 0 0 rgb(var(--v-theme-primary));
  z-index: 1;
}
/* Keyboard focus mirrors hover + a clear outline for a11y (rows are role=button). */
.sdv-tr:focus-visible {
  background: rgba(var(--v-theme-primary), .08);
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
  z-index: 2;
}

.sdv-table td {
  padding: 10px 16px;
  vertical-align: middle;
}

/* ── Dark-mode zebra bump ─────────────────────────────────────────────
   La franja zebra usa `--sdv-zebra` (default .045 = tema claro). En oscuro
   la misma opacidad de un on-surface claro contrasta menos sobre el fondo
   oscuro, así que se sube a .065. La variable se declara en el ancestro de
   tema (`:global`, vive fuera del scope) y se hereda hacia la tabla, por lo
   que cubre los dos modos (paginado y scroll) sin duplicar selectores. */
:global(.v-theme--tmweShipmentDark),
:global(.v-theme--shipmentV2Dark) {
  --sdv-zebra: 0.065;
}

.sdv-sentinel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 16px;
  min-height: 56px;
}

.sdv-sentinel-end {
  font-size: 11.5px;
  color: rgb(var(--v-theme-on-surface-variant));
  letter-spacing: .03em;
}
</style>
