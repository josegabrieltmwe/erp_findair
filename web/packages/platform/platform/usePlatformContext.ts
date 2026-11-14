import { computed, type ComputedRef } from 'vue';

/**
 * Platform context — derives the current module from
 * `window.location.pathname`. We intentionally do NOT use vue-router
 * here: each SPA has its own router instance, so the platform chrome
 * (which lives in shared/) can't assume any router shape.
 *
 * Module identifiers are stable identifiers used by the sidebar nav,
 * the topbar highlight, and analytics:
 *
 *   home      → /home
 *   cargo     → /erp/tmwe_json/cargo[/...]
 *   shipment  → /erp/tmwe_json/shipment[/...]
 *   admin     → /erp/tmwe_json/admin_config[/...]
 *
 * Anything else falls back to `unknown`.
 */

export type PlatformModule = 'home' | 'cargo' | 'shipment' | 'clients' | 'admin' | 'settings' | 'unknown';

interface PlatformContext {
  module: ComputedRef<PlatformModule>;
  /** True when the path matches a detail page (id segment present). */
  isDetail: ComputedRef<boolean>;
  /** Numeric id captured from the path, when the route is a detail. */
  detailId: ComputedRef<number | null>;
}

export function usePlatformContext(): PlatformContext {
  const pathname = computed(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );

  // QW3: la SPA `operations` monta su router bajo `/`
  // (ver router/index.ts, createWebHistory), pero estos regex solo conocían
  // las rutas legacy sin ese prefijo — `module` caía siempre a `unknown` en
  // cualquier página real de la app consolidada. `(?:ops\/)?` tolera ambas
  // sin duplicar la lista.
  const module = computed<PlatformModule>(() => {
    const p = pathname.value;
    if (/^\/erp\/tmwe_json\/(?:ops\/)?home(\/|$)/.test(p)) return 'home';
    if (/^\/erp\/tmwe_json\/(?:ops\/)?cargo(\/|$)/.test(p)) return 'cargo';
    if (/^\/erp\/tmwe_json\/(?:ops\/)?shipment(\/|$)/.test(p)) return 'shipment';
    if (/^\/erp\/tmwe_json\/(?:ops\/)?clients(\/|$)/.test(p)) return 'clients';
    if (/^\/erp\/tmwe_json\/(?:ops\/)?admin_config(\/|$)/.test(p)) return 'admin';
    if (/^\/erp\/tmwe_json\/(?:ops\/)?settings(\/|$)/.test(p)) return 'settings';
    return 'unknown';
  });

  const detailMatch = computed<RegExpMatchArray | null>(() => {
    // Cargo/shipment detail: trailing `/<digits>`.
    return pathname.value.match(/\/(cargo|shipment)\/(\d{1,12})(?:[/?]|$)/);
  });

  const isDetail = computed(() => detailMatch.value !== null);
  const detailId = computed<number | null>(() => {
    const m = detailMatch.value;
    if (!m) return null;
    const n = Number(m[2]);
    return Number.isFinite(n) ? n : null;
  });

  return { module, isDetail, detailId };
}
