import { ofetch } from 'ofetch';

/**
 * Generic counts response — both endpoints (`/api_courier_kpis` and
 * `/api_cargo_kpis`) return the same shape: `{ data: Record<string,number> }`.
 */
export interface KpiCountsResponse {
  data: Record<string, number>;
  /** `generated_at`: hora (ISO) del dato más antiguo; `cache`: hit | computed | stale. */
  meta?: { anagrafica_id?: number; ms?: number; generated_at?: string; cache?: string[] };
  error?: boolean | string;
}

/** Generic fetcher — caller passes the endpoint and an AbortSignal. */
export async function fetchKpiCounts(
  endpoint: '/api_courier_kpis' | '/api_cargo_kpis',
  opts: {
    signal?: AbortSignal;
    basePath?: string;
    /** true = botón "Actualizar": el servidor recalcula (acotado a 1 vez cada 15 s por dato). */
    refresh?: boolean;
    /** Recibe el `meta` de la respuesta (hora de cálculo del dato). */
    onMeta?: (meta: KpiCountsResponse['meta']) => void;
  } = {},
): Promise<Record<string, number>> {
  // The two SPAs already have their own `http` ofetch instance with
  // credentials + session handling, but to keep this file standalone
  // (no @/services/* import) we use ofetch directly. The base path
  // is whatever the SPA mounts under (defaults to /erp/tmwe_json).
  const basePath = opts.basePath ?? '/bff/v1';
  const res = await ofetch<KpiCountsResponse>(`${basePath}${endpoint}${opts.refresh ? '?refresh=1' : ''}`, {
    credentials: 'include',
    signal: opts.signal,
  });
  // El backend ya devuelve el tiempo de respuesta real (`meta.ms`); antes
  // nada lo leía. Solo en dev, para validar las estimaciones de QW1/QW2
  // contra el número real sin instrumentar nada en producción.
  if (import.meta.env.DEV && typeof res.meta?.ms === 'number') {
    console.debug(`[home-kpi] ${endpoint} resolved in ${res.meta.ms}ms`);
  }
  if (res.error || !res.data) {
    throw new Error(typeof res.error === 'string' ? res.error : 'Failed to load KPIs');
  }
  opts.onMeta?.(res.meta);
  return res.data;
}
