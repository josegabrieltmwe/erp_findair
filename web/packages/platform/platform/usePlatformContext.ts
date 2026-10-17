import { computed, type ComputedRef } from 'vue';

/**
 * Platform context — derives the current module + breadcrumb from
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

export interface BreadcrumbCrumb {
  /** i18n key resolved by the renderer (PlatformTopBar) via t(). When absent
   *  the raw `label` is shown verbatim (e.g. the `#id` detail crumb). */
  labelKey?: string;
  /** Verbatim label — used for non-translatable crumbs like `#123`. */
  label?: string;
  /** Absolute URL — full page reload between modules is the agreed flow. */
  href: string;
}

interface PlatformContext {
  module: ComputedRef<PlatformModule>;
  /** Breadcrumb starting with Home → … → current. */
  breadcrumb: ComputedRef<BreadcrumbCrumb[]>;
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
  // las rutas legacy sin ese prefijo — el breadcrumb caía siempre a "Home" en
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

  const breadcrumb = computed<BreadcrumbCrumb[]>(() => {
    const crumbs: BreadcrumbCrumb[] = [
      { labelKey: 'platform.nav.home', href: '/home' },
    ];
    switch (module.value) {
      case 'cargo':
        crumbs.push({ labelKey: 'platform.nav.cargo', href: '/cargo/list' });
        if (detailId.value) {
          crumbs.push({
            label: `#${detailId.value}`,
            href: `/cargo/${detailId.value}`,
          });
        }
        break;
      case 'shipment':
        crumbs.push({ labelKey: 'platform.nav.shipment', href: '/shipment/list' });
        if (detailId.value) {
          crumbs.push({
            label: `#${detailId.value}`,
            href: `/shipment/${detailId.value}`,
          });
        }
        break;
      case 'clients':
        crumbs.push({ labelKey: 'platform.nav.clients', href: '/clients' });
        if (detailId.value) {
          crumbs.push({
            label: `#${detailId.value}`,
            href: `/clients/${detailId.value}`,
          });
        }
        break;
      case 'admin':
        crumbs.push({ labelKey: 'platform.nav.admin', href: '/erp/tmwe_json/admin_config' });
        break;
      case 'settings':
        // Sin equivalente en la app legacy (es una página nueva de
        // `operations`); reusa la traducción ya existente del sidebar
        // (`platform.opsnav.settings`) en vez de duplicar la clave.
        crumbs.push({ labelKey: 'platform.opsnav.settings', href: '/settings' });
        break;
      case 'home':
        // Just the Home crumb itself — no extra hop.
        break;
      default:
        // Unknown route — leave the Home crumb only.
        break;
    }
    return crumbs;
  });

  return { module, breadcrumb, isDetail, detailId };
}
