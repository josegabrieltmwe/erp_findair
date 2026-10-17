/**
 * Cockpit store — ME2: sube el estado de los KPIs de Home a un store Pinia
 * singleton. Antes vivía en un composable (`useCockpitData`) con estado
 * cerrado por llamada, reiniciado en cada montaje de HomePage.vue — Home no
 * vive bajo `<KeepAlive>` (es la ruta `fullscreen`, ver OperationsShell.vue),
 * así que cada ida y vuelta a Home repetía el fetch completo aunque nada
 * hubiera cambiado.
 *
 * Patrón stale-while-revalidate con TTL corto (ver STALE_TTL_MS): un grupo
 * nunca pedido muestra el spinner de siempre; uno con datos pero vencido
 * sigue mostrando su valor cacheado al instante mientras se refresca en
 * segundo plano — sin parpadeo de "cargando" al volver a Home.
 *
 * QW2 ya bajó el costo de cada fetch individual a ~3-5ms en caché de backend
 * (ver service/home/Indicator_Registry_Service.php, medido en vivo: hasta
 * 18.2s en frío → <5ms con caché) — este store no busca evitar esa llamada,
 * busca evitar el roundtrip de red y el parpadeo visual en absoluto para
 * visitas repetidas dentro de la misma sesión de trabajo.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ofetch } from 'ofetch';
import { fetchKpiCounts } from './home_kpi.service';
import { HOME_KPI_CATALOG, type KpiCategory } from './home_kpi_catalog';

/**
 * Categorías cuyos números vienen de `api_home_box_indicators`.
 *
 * Se piden SOLO los indicadores que algún tile del catálogo muestra
 * (`countSource: 'indicators'`). Antes la lista estaba escrita a mano y pedía 16
 * indicadores de los que solo 8 tenían tile: los otros 8 se calculaban en el
 * servidor y se descartaban (uno, `active_customers_month`, tardaba decenas de
 * segundos). Si mañana se añade un tile a `warehouse` o `commercial_leads`, su
 * indicador entra solo en la petición.
 */
const INDICATOR_CATEGORIES = ['assist', 'warehouse', 'commercial_leads', 'tracking_indicators'] as const;

export function indicatorGroupsFromCatalog(
  catalog: ReadonlyArray<{ key: string; category: KpiCategory; countSource: string }> = HOME_KPI_CATALOG,
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const category of INDICATOR_CATEGORIES) {
    const ids = catalog
      .filter((k) => k.category === category && k.countSource === 'indicators')
      .map((k) => k.key);
    if (ids.length > 0) groups[category] = ids;
  }
  return groups;
}

const INDICATOR_GROUPS = indicatorGroupsFromCatalog();

interface IndicatorResponse {
  indicators?: Record<string, { count?: number } | number>;
  meta?: { generated_at?: string };
  error?: boolean | string;
}

type SourceGroupKey = 'courier' | 'cargo' | 'assist' | 'tracking_indicators' | 'warehouse' | 'commercial_leads';
type IndicatorGroupKey = 'assist' | 'tracking_indicators' | 'warehouse' | 'commercial_leads';

function isIndicatorGroup(key: SourceGroupKey): key is IndicatorGroupKey {
  return key === 'assist' || key === 'tracking_indicators' || key === 'warehouse' || key === 'commercial_leads';
}

const MAX_CONCURRENT = 3;
/** Cuánto se considera "fresco" un grupo antes de revalidarlo en silencio. */
const STALE_TTL_MS = 3 * 60_000;

/** `onGenerated` recibe la hora de cálculo (ISO) que informa el servidor para ese dato. */
type CockpitTask = (signal: AbortSignal, onGenerated: (iso: string | undefined) => void) => Promise<Record<string, number>>;

interface QueuedRequest {
  groupKeys: SourceGroupKey[];
  sources: string[];
  /** `true` = ya había datos (solo estaban vencidos): no toca `pending`, no muestra spinner. */
  silent: boolean;
  task: CockpitTask;
}

export const useCockpitStore = defineStore('cockpit', () => {
  const counts = ref<Record<string, number>>({});
  const pending = ref<Set<string>>(new Set());
  const errors = ref<Record<string, string>>({});
  /** Última vez que cada grupo se resolvió con éxito — base del TTL. */
  const lastFetchedAt = ref<Partial<Record<SourceGroupKey, number>>>({});
  /** Hora (ms) en que el servidor calculó el dato de cada grupo (puede ser anterior al fetch si venía de su caché). */
  const generatedAt = ref<Partial<Record<SourceGroupKey, number>>>({});
  /** Hora del dato más antiguo mostrado; null mientras no llegó ninguno. */
  const updatedAt = computed<number | null>(() => {
    const times = Object.values(generatedAt.value);
    return times.length > 0 ? Math.min(...times) : null;
  });

  const controllers = new Set<AbortController>();
  const queue: QueuedRequest[] = [];
  const inFlight = new Set<SourceGroupKey>();
  let activeRequests = 0;

  function merge(values: Record<string, number>): void {
    counts.value = { ...counts.value, ...values };
  }

  function clearErrorsFor(sources: string[]): void {
    if (Object.keys(errors.value).length === 0) return;
    const next = { ...errors.value };
    let changed = false;
    for (const s of sources) {
      if (s in next) {
        delete next[s];
        changed = true;
      }
    }
    if (changed) errors.value = next;
  }

  async function run(request: QueuedRequest): Promise<void> {
    const { groupKeys, sources, silent, task } = request;
    const controller = new AbortController();
    controllers.add(controller);
    // Estas queries agregadas legacy pueden legítimamente superar los 15s en
    // caché fría del backend (ver RM1) — QW2 ya lo mitiga, pero el timeout
    // sigue siendo necesario como última defensa.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60_000);
    try {
      const stamped: Partial<Record<SourceGroupKey, number>> = {};
      const values = await task(controller.signal, (iso) => {
        const t = iso ? Date.parse(iso) : NaN;
        if (Number.isNaN(t)) return;
        for (const key of groupKeys) stamped[key] = Math.min(stamped[key] ?? t, t);
      });
      generatedAt.value = { ...generatedAt.value, ...stamped };
      merge(values);
      clearErrorsFor(sources);
      const now = Date.now();
      for (const key of groupKeys) lastFetchedAt.value[key] = now;
    } catch (error) {
      if (controller.signal.aborted && !timedOut) return;
      // Una revalidación en silencio que falla no debe tapar el valor
      // cacheado con un error — el operador sigue viendo el último número
      // bueno; solo se loguea para no perder la señal del fallo.
      if (silent) {
        console.debug('[cockpit] revalidación en silencio falló', sources, error);
      } else {
        const message = timedOut
          ? 'KPI request timed out after 60 seconds'
          : error instanceof Error ? error.message : String(error);
        errors.value = { ...errors.value, ...Object.fromEntries(sources.map((s) => [s, message])) };
      }
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
      if (!silent) {
        const next = new Set(pending.value);
        for (const s of sources) next.delete(s);
        pending.value = next;
      }
      for (const key of groupKeys) inFlight.delete(key);
      activeRequests -= 1;
      dispatchQueue();
    }
  }

  function dispatchQueue(): void {
    while (activeRequests < MAX_CONCURRENT && queue.length > 0) {
      const next = queue.shift();
      if (!next) continue;
      activeRequests += 1;
      void run(next);
    }
  }

  async function fetchIndicators(
    ids: readonly string[],
    basePath: string,
    signal: AbortSignal,
    refresh: boolean,
    onGenerated: (iso: string | undefined) => void,
  ): Promise<Record<string, number>> {
    // Categoría sin tiles alimentados por indicadores (p. ej. `warehouse`): nada que pedir.
    if (ids.length === 0) return {};
    const query = new URLSearchParams({ ids: ids.join(',') });
    if (refresh) query.set('refresh', '1');
    const response = await ofetch<IndicatorResponse>(`${basePath}/api_home_box_indicators?${query}`, {
      credentials: 'include',
      signal,
    });
    if (response.error || !response.indicators) throw new Error(String(response.error || 'Indicators unavailable'));
    onGenerated(response.meta?.generated_at);
    return Object.fromEntries(
      Object.entries(response.indicators).map(([key, value]) => [
        key,
        typeof value === 'number' ? value : Number(value.count ?? 0),
      ]),
    );
  }

  function sourceGroups(
    basePath: string,
    refresh = false,
  ): Record<SourceGroupKey, { sources: KpiCategory[]; task: CockpitTask }> {
    const indicators = (group: IndicatorGroupKey): CockpitTask => (signal, onGenerated) =>
      fetchIndicators(INDICATOR_GROUPS[group] ?? [], basePath, signal, refresh, onGenerated);
    return {
      courier: {
        sources: ['courier_ops_in', 'courier_ops_out'],
        task: (signal, onGenerated) =>
          fetchKpiCounts('/api_courier_kpis', { basePath, signal, refresh, onMeta: (m) => onGenerated(m?.generated_at) }),
      },
      cargo: {
        sources: ['cargo_lifecycle', 'cargo_in_transit'],
        task: (signal, onGenerated) =>
          fetchKpiCounts('/api_cargo_kpis', { basePath, signal, refresh, onMeta: (m) => onGenerated(m?.generated_at) }),
      },
      assist: { sources: ['assist'], task: indicators('assist') },
      tracking_indicators: { sources: ['tracking_indicators'], task: indicators('tracking_indicators') },
      warehouse: { sources: ['warehouse'], task: indicators('warehouse') },
      commercial_leads: { sources: ['commercial_leads'], task: indicators('commercial_leads') },
    };
  }
  const ALL_GROUP_KEYS = Object.keys(sourceGroups('')) as SourceGroupKey[];

  function groupsFor(categories: readonly KpiCategory[] | undefined, groups: ReturnType<typeof sourceGroups>): SourceGroupKey[] {
    if (!categories) return ALL_GROUP_KEYS;
    const wanted = new Set(categories);
    return ALL_GROUP_KEYS.filter((key) => groups[key].sources.some((source) => wanted.has(source)));
  }

  type FetchState = 'fresh' | 'stale' | 'never';
  function freshnessOf(key: SourceGroupKey): FetchState {
    const t = lastFetchedAt.value[key];
    if (t === undefined) return 'never';
    return Date.now() - t < STALE_TTL_MS ? 'fresh' : 'stale';
  }

  /** Encola lo que haga falta de `keys` (ya filtrados por freshness/in-flight), fusionando grupos de indicadores (QW6) que compartan el mismo `silent`. */
  function enqueueGroups(keys: SourceGroupKey[], silentOf: Map<SourceGroupKey, boolean>, basePath: string, refresh = false): void {
    if (keys.length === 0) return;
    const groups = sourceGroups(basePath, refresh);
    for (const key of keys) inFlight.add(key);

    const nonSilentSources = keys.filter((k) => !silentOf.get(k)).flatMap((k) => groups[k].sources);
    if (nonSilentSources.length > 0) {
      const next = new Set(pending.value);
      for (const s of nonSilentSources) next.add(s);
      pending.value = next;
    }

    const otherKeys = keys.filter((k) => !isIndicatorGroup(k));
    for (const key of otherKeys) {
      const { sources, task } = groups[key];
      queue.push({ groupKeys: [key], sources, silent: silentOf.get(key) ?? false, task });
    }

    // QW6: fusiona los grupos de indicadores que compartan el mismo `silent`
    // (mezclar uno "nunca pedido" con uno "revalidando en silencio" obligaría
    // a tratar la respuesta entera como una sola cosa — más simple mandarlos
    // por separado en ese caso raro que complicar el silencio por-fuente).
    const indicatorKeys = keys.filter(isIndicatorGroup);
    for (const silent of [false, true]) {
      const batch = indicatorKeys.filter((k) => (silentOf.get(k) ?? false) === silent);
      if (batch.length === 0) continue;
      if (batch.length === 1) {
        const { sources, task } = groups[batch[0]];
        queue.push({ groupKeys: batch, sources, silent, task });
      } else {
        const ids = batch.flatMap((k) => INDICATOR_GROUPS[k] ?? []);
        const sources = batch.flatMap((k) => groups[k].sources);
        queue.push({ groupKeys: batch, sources, silent, task: (signal, onGenerated) => fetchIndicators(ids, basePath, signal, refresh, onGenerated) });
      }
    }

    dispatchQueue();
  }

  /**
   * Asegura que `categories` tengan datos frescos — es la única entrada que
   * usa HomePage.vue: al montar (sección activa), al cambiar de tab, y para
   * el prefetch idle del resto. Un grupo fresco no hace nada; uno sin datos
   * nunca pedidos se encola con spinner; uno con datos vencidos se revalida
   * en silencio (stale-while-revalidate).
   */
  function ensureCategories(categories: readonly KpiCategory[], basePath: string): void {
    const groups = sourceGroups(basePath);
    const keys = groupsFor(categories, groups);
    const silentOf = new Map<SourceGroupKey, boolean>();
    const toFetch: SourceGroupKey[] = [];
    for (const key of keys) {
      if (inFlight.has(key)) continue;
      const state = freshnessOf(key);
      if (state === 'fresh') continue;
      silentOf.set(key, state === 'stale');
      toFetch.push(key);
    }
    enqueueGroups(toFetch, silentOf, basePath);
  }

  /** Fuerza un refetch de `categories` ignorando el TTL y la caché del servidor — lo usan "Actualizar" y el retry. */
  function forceRefresh(categories: readonly KpiCategory[] | undefined, basePath: string): void {
    const groups = sourceGroups(basePath);
    const keys = groupsFor(categories, groups).filter((key) => !inFlight.has(key));
    const silentOf = new Map<SourceGroupKey, boolean>(keys.map((key) => [key, false]));
    enqueueGroups(keys, silentOf, basePath, true);
  }

  const loading = computed(() => pending.value.size > 0);

  return { counts, pending, errors, loading, updatedAt, ensureCategories, forceRefresh };
});
