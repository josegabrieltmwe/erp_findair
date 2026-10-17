/**
 * Common types for the shared list view component.
 * Both cargo and shipment list stores can satisfy ListSource by exposing
 * a thin adapter (see CargoListPage / ShipmentListPage for examples).
 */

export interface ListSource<TRow> {
  /** Total number of rows matching the current filters (server-side). */
  total: number;
  /** Currently loaded rows. In paginated mode == one page. In infinite mode == accumulated. */
  rows: TRow[];
  /** True while a fetch is in flight (initial OR appendix). */
  loading: boolean;
  /** Latest error from the underlying service, if any. */
  error: string | null;
  /** Active page (1-indexed). Drives v-data-table-server in paginated mode. */
  page: number;
  /** Page size. */
  perPage: number;
  /** Active sort column in backend syntax (e.g. 'sp.data_sped1'). */
  sort: string;
  sortDir: 'ASC' | 'DESC';
  /** Replace current data with the page indicated by `page`. */
  loadPage: (page: number) => Promise<void>;
  /** Append next page after current accumulated data (infinite mode). */
  loadMore: () => Promise<void>;
  /** Reset accumulator and reload from page 1 (used when filters change). */
  refresh: () => Promise<void>;
  /** Update sort + reset to page 1. */
  setSort: (sort: string, dir: 'ASC' | 'DESC') => void;
  /** Update perPage + reset to page 1. */
  setPerPage: (n: number) => void;
}

export interface DataTableHeader {
  title: string;
  key: string;
  width?: number;
  sortable?: boolean;
  align?: 'start' | 'end' | 'center';
  /** Enables the shared click-to-filter gesture for this column. */
  filterable?: boolean;
  /** Store/filter key when it differs from the displayed property. */
  filterField?: string;
  /** Explicit numeric formatting/alignment. Also inferred for common amount fields. */
  numeric?: boolean;
}

export interface ListingWorkView {
  /** Stable URL identifier. */
  id: string;
  /** Translation key resolved by the consuming application. */
  labelKey: string;
  /** Ordered list of symbolic DataTableHeader keys. */
  columns: readonly string[];
  /** Listing types for which this view is valid. Empty means all types. */
  compatibleTypes?: readonly string[];
  /** Bulk action identifiers exposed by this view. */
  bulkActions?: readonly string[];
  /** Suggested bulk action, if any. */
  suggestedBulkAction?: string;
  /** Backend capabilities required before the view can be exposed. */
  requiredCapabilities?: readonly string[];
}

export interface ListingCellClick<TRow = Record<string, unknown>> {
  field: string;
  value: unknown;
  label: string;
  row: TRow;
}

export interface DataTableSortBy {
  key: string;
  order: 'asc' | 'desc';
}

/**
 * One active filter, surfaced as a removable chip above the listing.
 * `field` identifies which store key it maps to (so removing it resets
 * exactly that key); `group` is the human label for the column it came
 * from, `value` the value the operator clicked. `iso` lets the chip
 * render a country flag for lane filters.
 */
export interface ActiveFilter {
  field: string;
  group: string;
  value: string;
  iso?: string;
  /** Vuetify color for the chip (defaults to primary). */
  color?: string;
}
