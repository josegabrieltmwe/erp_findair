/**
 * Quién puede abrir cada pantalla de Settings, decidido con los scopes del token y no solo con `is_admin`.
 *
 * Regla de la SPA (solo UX; la API autoriza cada petición):
 *   - TMWE (`is_admin`, anagrafica 1) entra a todo lo que entraba hasta ahora: es el respaldo y no cambia.
 *   - Una persona que no es TMWE entra solo a las rutas de esta tabla y solo si tiene TODOS sus scopes.
 *
 * Qué entra en la tabla (verificado con `Authz_Service` y los roles de `tmwe_development`, 2026-10-25):
 *   - Rutas cuyo endpoint declara una política por módulo en el API. Las `admin_only` exigen anagrafica 1 en el
 *     propio API (ningún scope las sustituye) y las `public_oauth` no distinguen a nadie: ambas siguen siendo TMWE.
 *   - Solo scopes que tienen únicamente roles de personal (STAFF_ONLY_SCOPES). `shipment:read`, `contacts:read`,
 *     `crm:read`, `invoices:read` o `payments:read` los tienen también clientes (findair_basic, accounting_viewer):
 *     mapearlos abriría a un cliente pantallas como márgenes de beneficio. Tampoco `driver:read`: el conductor
 *     ve solo lo suyo y las zonas son de despacho.
 * Al añadir una ruta aquí, el spec comprueba que su scope esté en STAFF_ONLY_SCOPES.
 */
import { hasScope, type AccessSnapshot } from '@shared/composables/useAccess';

export const STAFF_ONLY_SCOPES: ReadonlySet<string> = new Set(['config:read', 'suppliers:read']);

export const SETTINGS_ROUTE_SCOPES: Readonly<Record<string, readonly string[]>> = {
  'settings-carrier-services': ['suppliers:read'],
  'settings-pallet-types': ['suppliers:read'],
  'settings-pallet-mpl': ['suppliers:read'],
  'settings-carrier-blocks': ['suppliers:read'],
  'settings-supplier-tracking-codes': ['suppliers:read'],
  'settings-issuer-bank-accounts': ['config:read'],
  'settings-cargo-carriers': ['config:read'],
  'settings-cargo-handlers': ['config:read'],
  'settings-cargo-charges': ['config:read'],
  'settings-document-models': ['config:read'],
  'settings-site-notices': ['config:read'],
};

export interface AccessContext {
  /** `is_admin` del perfil: `true` solo para TMWE (anagrafica 1). */
  isAdmin: boolean | null;
  access: AccessSnapshot;
}

/** ¿Puede abrir esta ruta marcada `requiresAdmin`? Falla cerrado si el perfil no se conoce. */
export function canOpenAdminRoute(routeName: string, ctx: AccessContext): boolean {
  if (ctx.isAdmin === true) return true;
  const scopes = SETTINGS_ROUTE_SCOPES[routeName];
  if (!scopes || !ctx.access.known) return false;
  return hasScope(ctx.access, scopes, 'all');
}

/** El hub se abre si TMWE o si hay al menos una tarjeta que la persona pueda abrir. */
export function canEnterSettingsHub(ctx: AccessContext): boolean {
  if (ctx.isAdmin === true) return true;
  return Object.keys(SETTINGS_ROUTE_SCOPES).some((name) => canOpenAdminRoute(name, ctx));
}
