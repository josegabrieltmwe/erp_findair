/**
 * Home dashboard KPI catalog — single source of truth.
 *
 * Each entry declares both:
 *   - what the tile shows (icon, label, count source)
 *   - where the click navigates (listing route + querystring filter)
 *
 * The same catalog is consumed by both SPAs; each spa filters by
 * `category` to render only its relevant KPIs. The `link` field
 * references the listing routes (`shipment-list` / `cargo-list`)
 * which expose them via the `type=` parameter handled in the
 * Filter_Analyzer / Cargo_Filter_Analyzer kpi_* presets.
 *
 * @see service/listing/Filter_Analyzer.php  — kpi_* cases
 * @see service/listing/Cargo_Filter_Analyzer.php — kpi_* cases
 */

export type KpiCategory =
  | 'courier_ops_in'
  | 'courier_ops_out'
  | 'cargo_lifecycle'
  | 'cargo_in_transit'
  | 'assist'
  | 'warehouse'
  | 'commercial_leads'
  | 'tracking_indicators';

export type HomeSectionId =
  | 'morning'
  | 'operations_in'
  | 'operations_out'
  | 'assistance'
  | 'administration'
  | 'warehouse'
  | 'commercial';

export interface HomeKpiDescriptor {
  /** Stable id, matches the backend KPI count key. */
  key: string;
  /** Logical group (used to filter the catalog per SPA). */
  category: KpiCategory;
  /** Operational lifecycle section, independent from the data bucket. */
  section: HomeSectionId;
  /** Display group inside the SPA (header band). */
  group: string;
  icon: string;
  label: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  /** Backend KPI count endpoint that supplies this count. */
  countSource: 'courier' | 'cargo' | 'indicators';
  /** True only when the target list applies the tile filter on the server. */
  serverFiltered: boolean;
  /** Listing navigation on tile click. */
  link: {
    page: 'shipment-list' | 'cargo-list' | 'crm-list' | 'giacenze-list';
    query: Record<string, string>;
  };
}

export const HOME_KPI_CATALOG: HomeKpiDescriptor[] = [
  // ===========================================================
  // COURIER OPS IN (homebox 1) — not yet departed
  // ===========================================================
  {
    key: 'preseint',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Pickup',
    icon: 'mdi-package-up-outline',
    label: 'Prese da gestire',
    description: 'Da assegnare al corriere',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'preseint' } },
  },
  {
    key: 'presefornN',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Pickup',
    icon: 'mdi-package-up',
    label: 'Da organizzare',
    description: 'Prese fornitore stato N',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'presefornN' } },
  },
  {
    key: 'presefornF',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Pickup',
    icon: 'mdi-alert-circle-outline',
    label: 'Con problemi',
    description: 'Prese fornitore stato F',
    variant: 'error',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'presefornF' } },
  },
  {
    key: 'presefornW',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Pickup',
    icon: 'mdi-clock-alert-outline',
    label: 'In attesa conferma',
    description: 'Prese pick-up stato W',
    variant: 'warning',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'presefornW' } },
  },
  {
    key: 'presefornS',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Pickup',
    icon: 'mdi-email-fast-outline',
    label: 'AWB da inviare',
    description: 'AWB pronto, mittente da informare',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'presefornS' } },
  },

  {
    key: 'badaddr',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Ricezione & controllo',
    icon: 'mdi-map-marker-alert',
    label: 'Indirizzo errato',
    variant: 'error',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'badaddr' } },
  },
  {
    key: 'dactrnote',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Ricezione & controllo',
    icon: 'mdi-note-alert-outline',
    label: 'Non controllate con note',
    variant: 'warning',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'dactrnote' } },
  },
  {
    key: 'dacontr',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Ricezione & controllo',
    icon: 'mdi-clipboard-alert-outline',
    label: 'Da controllare',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'dacontr' } },
  },
  {
    key: 'contrnopart',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Pronte & partenze',
    icon: 'mdi-clipboard-check-outline',
    label: 'Controllate, non partite',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'contrnopart' } },
  },

  {
    key: 'spedoggi',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Pronte & partenze',
    icon: 'mdi-calendar-today-outline',
    label: 'Spedizioni di oggi',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'spedoggi' } },
  },
  {
    key: 'offert',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Ricezione & controllo',
    icon: 'mdi-tag-outline',
    label: 'Offerte',
    variant: 'warning',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'offert' } },
  },
  {
    key: 'deipartn',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Partner',
    icon: 'mdi-account-multiple-outline',
    label: 'Partner, non partite',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'deipartn' } },
  },

  // ===========================================================
  // COURIER OPS OUT (homebox 2) — in transit / delivered
  // ===========================================================
  {
    key: 'presefornQ',
    category: 'courier_ops_out',
    section: 'operations_out',
    group: 'Tracking',
    icon: 'mdi-radar',
    label: 'Senza tracking',
    description: 'Partite ma stato 1/16',
    variant: 'warning',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'presefornQ' } },
  },
  {
    key: 'presefornX',
    category: 'courier_ops_out',
    section: 'operations_out',
    group: 'Tracking',
    icon: 'mdi-alert-octagon-outline',
    label: 'Problemi di ritiro',
    description: 'Stato tracking 26',
    variant: 'error',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'presefornX' } },
  },
  {
    key: 'indelay',
    category: 'courier_ops_out',
    section: 'operations_out',
    group: 'Tracking',
    icon: 'mdi-clock-alert',
    label: 'In ritardo',
    description: 'Oltre la data prevista',
    variant: 'error',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'indelay' } },
  },
  {
    key: 'intransit',
    category: 'courier_ops_out',
    section: 'operations_out',
    group: 'In transit',
    icon: 'mdi-truck-fast',
    label: 'In transit',
    variant: 'success',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'in_transit' } },
  },
  {
    key: 'deipartn2',
    category: 'courier_ops_out',
    section: 'operations_out',
    group: 'In transit',
    icon: 'mdi-account-multiple',
    label: 'Partner in transit',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'deipartn2' } },
  },
  // F2.1 — Servizi prioritari in transit.
  {
    key: 'intransit2',
    category: 'courier_ops_out',
    section: 'operations_out',
    group: 'In transit',
    icon: 'mdi-flash',
    label: 'Servizi prioritari in transit',
    variant: 'warning',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'intransit2' } },
  },
  // F2.2 — Tracking problemi senza giacenza aperta.
  {
    key: 'nogiacprobl',
    category: 'courier_ops_out',
    section: 'operations_out',
    group: 'In transit',
    icon: 'mdi-alert-decagram-outline',
    label: 'Tracking problemi senza giacenza',
    variant: 'error',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'nogiacprobl' } },
  },
  // F2.3 — Cod cliente fornitore non nostri.
  // Previously these two tiles formed their own `Codici cliente`
  // group, which produced an awkward 2-tile orphan section sitting
  // between courier and cargo. They are now folded into the
  // workflow / in-transit groups they belong to logically.
  {
    key: 'codcliprnt',
    category: 'courier_ops_in',
    section: 'operations_in',
    group: 'Partner',
    icon: 'mdi-account-tag-outline',
    label: 'Cod cliente non nostri, non partite',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'codcliprnt' } },
  },
  {
    key: 'codcliprnt2',
    category: 'courier_ops_out',
    section: 'operations_out',
    group: 'In transit',
    icon: 'mdi-account-tag',
    label: 'Cod cliente non nostri, in transit',
    countSource: 'courier',
    serverFiltered: true,
    link: { page: 'shipment-list', query: { type: 'codcliprnt2' } },
  },

  // ===========================================================
  // CARGO LIFECYCLE (homebox 3) — quoting + acceptance
  // ===========================================================
  {
    key: 'toqt',
    category: 'cargo_lifecycle',
    section: 'commercial',
    group: 'Quoting',
    icon: 'mdi-clipboard-edit-outline',
    label: 'Da quotare',
    countSource: 'cargo',
    serverFiltered: true,
    link: { page: 'cargo-list', query: { type: 'toqt' } },
  },
  {
    key: 'inqt',
    category: 'cargo_lifecycle',
    section: 'commercial',
    group: 'Quoting',
    icon: 'mdi-clipboard-clock-outline',
    label: 'In quotazione',
    variant: 'warning',
    countSource: 'cargo',
    serverFiltered: true,
    link: { page: 'cargo-list', query: { type: 'inqt' } },
  },
  {
    key: 'clwt',
    category: 'cargo_lifecycle',
    section: 'commercial',
    group: 'Quoting',
    icon: 'mdi-account-clock-outline',
    label: 'Attesa cliente',
    countSource: 'cargo',
    serverFiltered: true,
    link: { page: 'cargo-list', query: { type: 'clwt' } },
  },
  {
    key: 'toorg',
    category: 'cargo_lifecycle',
    section: 'commercial',
    group: 'Quoting',
    icon: 'mdi-check-decagram-outline',
    label: 'Accettate, da organizzare',
    variant: 'success',
    countSource: 'cargo',
    serverFiltered: true,
    link: { page: 'cargo-list', query: { type: 'toorg' } },
  },
  {
    key: 'qtko',
    category: 'cargo_lifecycle',
    section: 'commercial',
    group: 'Quoting',
    icon: 'mdi-close-octagon-outline',
    label: 'Rifiutate',
    variant: 'error',
    countSource: 'cargo',
    serverFiltered: true,
    link: { page: 'cargo-list', query: { type: 'qtko' } },
  },

  // ===========================================================
  // CARGO IN TRANSIT (homebox 3 bottom block)
  // ===========================================================
  {
    key: 'nofly',
    category: 'cargo_in_transit',
    section: 'operations_out',
    group: 'In viaggio',
    icon: 'mdi-airplane-clock',
    label: 'Pronte, non in volo',
    variant: 'warning',
    countSource: 'cargo',
    serverFiltered: true,
    link: { page: 'cargo-list', query: { type: 'nofly' } },
  },
  {
    key: 'vgvol',
    category: 'cargo_in_transit',
    section: 'operations_out',
    group: 'In viaggio',
    icon: 'mdi-airplane',
    label: 'In volo',
    variant: 'success',
    countSource: 'cargo',
    serverFiltered: true,
    link: { page: 'cargo-list', query: { type: 'vgvol' } },
  },
  {
    key: 'vgloc',
    category: 'cargo_in_transit',
    section: 'operations_out',
    group: 'In viaggio',
    icon: 'mdi-truck-outline',
    label: 'Presa locale in viaggio',
    countSource: 'cargo',
    serverFiltered: true,
    link: { page: 'cargo-list', query: { type: 'vgloc' } },
  },
  {
    key: 'vgrem',
    category: 'cargo_in_transit',
    section: 'operations_out',
    group: 'In viaggio',
    icon: 'mdi-truck-delivery-outline',
    label: 'Consegna locale in viaggio',
    countSource: 'cargo',
    serverFiltered: true,
    link: { page: 'cargo-list', query: { type: 'vgrem' } },
  },
  // Solo se publican indicadores con un drill-down verificable.
  ...(
    [
      ['open_cases', 'assist', 'assistance', 'Pratiche', 'mdi-lifebuoy', 'Pratiche aperte', 'crm-list', 'open_cases'],
      [
        'overdue_followups',
        'assist',
        'assistance',
        'Pratiche',
        'mdi-clock-alert-outline',
        'Follow-up scaduti',
        'crm-list',
        'overdue_followups',
      ],
      [
        'open_giacenze',
        'assist',
        'assistance',
        'Giacenze',
        'mdi-package-variant',
        'Giacenze aperte',
        'giacenze-list',
        'open_giacenze',
      ],
      [
        'giacenze_overdue_15',
        'assist',
        'assistance',
        'Giacenze',
        'mdi-package-variant-closed-alert',
        'Giacenze oltre 15 giorni',
        'giacenze-list',
        'giacenze_overdue_15',
      ],
      [
        'awaiting_client_response',
        'assist',
        'assistance',
        'Comunicazioni',
        'mdi-message-reply-text-outline',
        'In attesa del cliente',
        'giacenze-list',
        'awaiting_client_response',
      ],
      [
        'retraso',
        'tracking_indicators',
        'operations_out',
        'Tracking',
        'mdi-clock-alert-outline',
        'In ritardo',
        'shipment-list',
        'indelay',
      ],
      [
        'en_transito',
        'tracking_indicators',
        'operations_out',
        'In transit',
        'mdi-truck-fast-outline',
        'In transito',
        'shipment-list',
        'in_transit',
      ],
      [
        'sin_tracking',
        'tracking_indicators',
        'operations_out',
        'Tracking',
        'mdi-radar-off',
        'Senza tracking',
        'shipment-list',
        'presefornQ',
      ],
      [
        'tracking_problemas',
        'tracking_indicators',
        'operations_out',
        'Tracking',
        'mdi-alert-circle-outline',
        'Problemi tracking',
        'shipment-list',
        'nogiacprobl',
      ],
    ] as const
  ).map(([key, category, section, group, icon, label, page, filter]) => ({
    key,
    category,
    section,
    group,
    icon,
    label,
    countSource: 'indicators' as const,
    serverFiltered: true,
    link: {
      page,
      query: {
        [page === 'shipment-list' ? 'type' : 'indicator']: filter,
      },
    },
  })),
];

/** Group KPIs by their `group` field, preserving catalog order. */
export function groupKpis(kpis: HomeKpiDescriptor[]): Array<{ group: string; tiles: HomeKpiDescriptor[] }> {
  const groups: Array<{ group: string; tiles: HomeKpiDescriptor[] }> = [];
  const indexByGroup = new Map<string, number>();
  for (const kpi of kpis) {
    let idx = indexByGroup.get(kpi.group);
    if (idx === undefined) {
      idx = groups.length;
      indexByGroup.set(kpi.group, idx);
      groups.push({ group: kpi.group, tiles: [] });
    }
    groups[idx].tiles.push(kpi);
  }
  return groups;
}

/**
 * High-level section ids — the three legacy "home_boxi" blocks. Each
 * section bundles 1+ categories from above and is rendered as a
 * collapsible card on the home page.
 *
 * The order of `SECTION_ORDER` is the order the home renders top-to-
 * bottom. Adding a new category? extend the matching section, don't
 * leave KPIs at the mercy of catalog declaration order.
 */
export interface HomeSectionSpec {
  id: HomeSectionId;
  /** Header copy. */
  title: string;
  icon: string;
  /** Human-readable lifecycle shown below the primary tabs. */
  flow: string;
  /** Categories whose KPIs render inside this section. */
  categories: KpiCategory[];
  /** Display order of the `group` field within the section. */
  groupOrder: string[];
  /**
   * Listing the section drills into when the operator clicks the
   * "open list" button on the section header. Same shape as the
   * per-tile `link` so the home page can hand it straight to
   * vue-router.
   */
  listLink: {
    page: 'shipment-list' | 'cargo-list';
    query: Record<string, string>;
  };
  /** Short label for the open-list affordance (button tooltip / a11y). */
  listLabel: string;
}

/**
 * Canonical home layout — three blocks that mirror the legacy
 * `home_boxi_1` / `home_boxi_2` / `home_boxi_3` structure and isolate
 * the courier and cargo domains visually.
 */
export const HOME_SECTIONS: HomeSectionSpec[] = [
  {
    id: 'morning',
    title: 'Morning priorities',
    icon: 'mdi-weather-sunset-up',
    flow: 'controllare → correggere → sbloccare → partire',
    categories: ['courier_ops_in'],
    groupOrder: ['Morning priorities'],
    listLink: { page: 'shipment-list', query: { type: 'all' } },
    listLabel: 'Apri priorità del mattino',
  },
  {
    id: 'operations_in',
    title: 'Operativo IN',
    icon: 'mdi-truck-fast-outline',
    flow: 'ricezione → controllo → presa → pronta a partire',
    categories: ['courier_ops_in'],
    groupOrder: ['Ricezione & controllo', 'Pickup', 'Pronte & partenze', 'Partner'],
    // ops_in covers everything not yet departed; the express listing's
    // `all` view shows that with the operator's existing scope.
    listLink: { page: 'shipment-list', query: { type: 'all' } },
    listLabel: 'Apri lista spedizioni',
  },
  {
    id: 'operations_out',
    title: 'Operativo OUT',
    icon: 'mdi-radar',
    flow: 'partenza → tracking → transito → consegna',
    categories: ['courier_ops_out', 'cargo_in_transit', 'tracking_indicators'],
    groupOrder: ['Tracking', 'In transit', 'In viaggio'],
    // Drill straight into the in-transit cohort.
    listLink: { page: 'shipment-list', query: { type: 'in_transit' } },
    listLabel: 'Apri lista in transito',
  },
  {
    id: 'assistance',
    title: 'Assistenza',
    icon: 'mdi-lifebuoy',
    flow: 'pratiche → giacenze → comunicazioni',
    categories: ['assist'],
    groupOrder: ['Pratiche', 'Giacenze', 'Comunicazioni'],
    listLink: { page: 'shipment-list', query: { type: 'all' } },
    listLabel: 'Apri assistenza',
  },
  {
    id: 'administration',
    title: 'Amministrazione',
    icon: 'mdi-cash-check',
    flow: 'fatturare → incassare → sollecitare → bloccare',
    categories: [],
    groupOrder: [],
    listLink: { page: 'shipment-list', query: { type: 'all' } },
    listLabel: 'Apri amministrazione',
  },
  {
    id: 'warehouse',
    title: 'Magazzino',
    icon: 'mdi-warehouse',
    flow: 'pesata → manifest → chiusura',
    categories: ['warehouse'],
    groupOrder: ['Logistica', 'Controllo', 'Chiusura'],
    listLink: { page: 'shipment-list', query: { type: 'all' } },
    listLabel: 'Apri magazzino',
  },
  {
    id: 'commercial',
    title: 'Commerciale',
    icon: 'mdi-chart-line',
    flow: 'lead → offerte → clienti',
    categories: ['cargo_lifecycle', 'commercial_leads'],
    groupOrder: ['Quoting', 'Clienti'],
    listLink: { page: 'cargo-list', query: { type: 'all' } },
    listLabel: 'Apri commerciale',
  },
];

/**
 * Build the section→groups→tiles tree the home page renders.
 *
 * Unlike `groupKpis()`, the order is taken from `HOME_SECTIONS` /
 * `groupOrder`, NOT from catalog declaration order — so adding a new
 * KPI in any position keeps the layout stable. Groups not listed in
 * `groupOrder` are appended at the end (cheap safety net for typos).
 */
export function groupKpisBySection(kpis: HomeKpiDescriptor[]): Array<{
  section: HomeSectionSpec;
  groups: Array<{ group: string; tiles: HomeKpiDescriptor[] }>;
}> {
  return HOME_SECTIONS.filter((section) => section.categories.length > 0).map((section) => {
    if (section.id === 'morning') {
      const tiles = MORNING_KEYS.map((key) => kpis.find((k) => k.key === key)).filter(
        (k): k is HomeKpiDescriptor => k != null,
      );
      return { section, groups: [{ group: 'Morning priorities', tiles }] };
    }

    const inSection = kpis.filter((k) => k.section === section.id);
    const byGroup = new Map<string, HomeKpiDescriptor[]>();
    for (const k of inSection) {
      const bucket = byGroup.get(k.group);
      if (bucket) bucket.push(k);
      else byGroup.set(k.group, [k]);
    }
    const orderedGroupNames = [
      ...section.groupOrder.filter((g) => byGroup.has(g)),
      ...Array.from(byGroup.keys()).filter((g) => !section.groupOrder.includes(g)),
    ];
    return {
      section,
      groups: orderedGroupNames.map((g) => ({
        group: g,
        tiles: byGroup.get(g) ?? [],
      })),
    };
  });
}

/**
 * Look up a KPI descriptor by its catalog `key` — the same value the
 * backend uses as `type=` on the listing endpoints. Returns `null` for
 * non-catalog types (the listing's own `all`, `in_transit`, … macro
 * categories) so callers can fall back to a generic label.
 *
 * Used by the listing pages to render a contextual chip when the user
 * arrives via a home-tile deep-link (e.g. `/shipment/list?type=dacontr`).
 */
export function findKpiByKey(key: string | null | undefined): HomeKpiDescriptor | null {
  if (!key) return null;
  return HOME_KPI_CATALOG.find((k) => k.key === key) ?? null;
}

/** Resolve the tile that originated a listing deep-link.
 *
 * `type` is the backend preset and is not always the catalog key. The optional
 * semantic key carried as `kpi=` removes that ambiguity; old bookmarks without
 * it still resolve by destination and backend type.
 */
export function findKpiForListing(
  page: HomeKpiDescriptor['link']['page'],
  type: string | null | undefined,
  semanticKey?: string | null,
): HomeKpiDescriptor | null {
  if (semanticKey) {
    const semantic = findKpiByKey(semanticKey);
    if (semantic?.link.page === page && (!type || semantic.link.query.type === type)) {
      return semantic;
    }
  }
  if (!type) return null;
  return HOME_KPI_CATALOG.find((kpi) => kpi.link.page === page && kpi.link.query.type === type) ?? null;
}

/* ============================================================
   i18n resolution helpers.

   The catalog keeps its Italian `label`/`description`/`group`/`title`
   as the canonical fallback (so nothing breaks if a key is missing),
   but callers should render the *translated* text via these helpers,
   passing their app's `t` from useI18n(). Keys live under `kpi.*`:

     kpi.tile.<key>.label / .desc   — per-tile
     kpi.group.<slug>               — group band header
     kpi.section.<id>.title / .list — section header + open-list label

   `slugifyGroup` maps the human group string ("In viaggio") to a stable
   key slug ("in_viaggio") so translators key off something deterministic.
============================================================ */

type TFn = (key: string, fallback?: string) => string;

/** Stable slug for a group name, used as the i18n key suffix. */
export function slugifyGroup(group: string): string {
  return group
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Translated tile label (falls back to the catalog's Italian label). */
export function kpiLabel(t: TFn, kpi: HomeKpiDescriptor): string {
  return t(`kpi.tile.${kpi.key}.label`, kpi.label);
}

/** Translated tile description (empty when the catalog has none). */
export function kpiDescription(t: TFn, kpi: HomeKpiDescriptor): string {
  if (!kpi.description) return '';
  return t(`kpi.tile.${kpi.key}.desc`, kpi.description);
}

/** Translated group band header. */
export function kpiGroupLabel(t: TFn, group: string): string {
  return t(`kpi.group.${slugifyGroup(group)}`, group);
}

/** Translated section title. */
export function kpiSectionTitle(t: TFn, section: HomeSectionSpec): string {
  return t(`kpi.section.${section.id}.title`, section.title);
}

/** Translated section open-list label. */
export function kpiSectionListLabel(t: TFn, section: HomeSectionSpec): string {
  return t(`kpi.section.${section.id}.list`, section.listLabel);
}

/** Translated section flow line (shown under the horizontal tabs). */
export function kpiSectionFlow(t: TFn, section: HomeSectionSpec): string {
  return t(`kpi.section.${section.id}.flow`, section.flow);
}

/** KPI reales reutilizados en la franja fija del arranque del día. */
export const MORNING_KEYS: string[] = ['dacontr', 'badaddr', 'contrnopart', 'spedoggi'];
