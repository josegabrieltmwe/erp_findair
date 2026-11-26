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
 *     `crm:read`, `invoices:read`, `payments:read` o `payment_gateways:*` los tienen también clientes (findair_basic, accounting_viewer):
 *     mapearlos abriría a un cliente pantallas como márgenes de beneficio. Tampoco `driver:read`: el conductor
 *     ve solo lo suyo y las zonas son de despacho.
 * Al añadir una ruta aquí, el spec comprueba que su scope esté en STAFF_ONLY_SCOPES.
 */
import { hasScope, type AccessSnapshot } from '@shared/composables/useAccess';

// `margins:read` (módulo margenes_clientes) lo tienen solo tmwe_staff_portal/_impersonator, app_internal_erp(_staff) y el
// aditivo partner_pricing («solo personal de partner; nunca clientes finales», rbac_seed.yml, 2026-11-06).
// `partner_agent:read` (N15, collaudo 16/11): solo partner_staff/partner_staff_ai_admin y los techos
// app_internal_erp(_staff)/app_partner_erp lo llevan (rbac_seed.yml) — ningún rol de cliente final.
// `erp:view` (entrar al ERP): solo los techos app_internal_erp(_staff)/app_partner_erp y el aditivo erp_operator («Solo
// personal TMWE y partner; los clientes con auth_10 NO lo reciben»). `partner:manage`: los mismos techos y el aditivo
// partner_admin («no se concede a clientes finales»). rbac_seed.yml, comprobado el 2026-11-25.
export const STAFF_ONLY_SCOPES: ReadonlySet<string> = new Set([
  'config:read',
  'suppliers:read',
  'margins:read',
  'partner_agent:read',
  'erp:view',
  'partner:manage',
]);

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
  // Clientes sin margen: Customers_Without_Margin (módulo margenes_clientes); el partner ve solo los suyos.
  'settings-customers-without-margin': ['margins:read'],
  // Agente de voz propio del partner (N15): sin esta entrada, el personal real
  // de un partner (no TMWE, sin suplantación) nunca veía la tarjeta en su propio
  // hub de Ajustes aunque el backend sí le permitiera usar la pantalla.
  'settings-elevenlabs-my-agent': ['partner_agent:read'],
  // Auto-registro de FindAir (P147). Cola y ficha: Self_Registration_Admin_Controller exige TMWE o erp:view (más el
  // módulo anagrafiche, que lo comprueba la API). Configuración: TMWE o partner:manage (PARTNER_ADMIN_REQUIRED).
  'settings-self-registrations': ['erp:view'],
  'settings-self-registration-detail': ['erp:view'],
  'settings-self-registration-config': ['partner:manage'],
};

/**
 * Rutas de Settings que CUALQUIER usuario autenticado puede abrir, sin exigir
 * `is_admin` NI ningún scope — porque el endpoint que consumen declara una
 * política `public_oauth` sin requisito de scope (literalmente cualquier
 * cliente OAuth autenticado). A diferencia de `SETTINGS_ROUTE_SCOPES` (que
 * exige un scope de `STAFF_ONLY_SCOPES`, pensado para pantallas de personal, o
 * uno que también tienen clientes pero acotado a un recurso concreto), aquí no
 * hay ningún scope que exigir: el backend ya es el único filtro real.
 *
 * Primer caso: autoservicio de aplicaciones OAuth2 propias
 * (`Portal_My_Clients_Controller`, policy `public_oauth`, ver
 * docs/contrato-con-api.md → "portal_my_clients"). Antes de añadir una ruta
 * aquí, confirma que su policy en el backend es realmente pública (sin scope)
 * — si exige alguno, va en SETTINGS_ROUTE_SCOPES, no aquí.
 */
export const SETTINGS_ROUTES_OPEN_TO_ANY_USER: ReadonlySet<string> = new Set([
  'settings-my-oauth-clients',
]);

export interface AccessContext {
  /** `is_admin` del perfil: `true` solo para TMWE (anagrafica 1). */
  isAdmin: boolean | null;
  access: AccessSnapshot;
}

/** ¿Puede abrir esta ruta marcada `requiresAdmin`? Falla cerrado si el perfil no se conoce. */
export function canOpenAdminRoute(routeName: string, ctx: AccessContext): boolean {
  if (ctx.isAdmin === true) return true;
  if (SETTINGS_ROUTES_OPEN_TO_ANY_USER.has(routeName)) return true;
  const scopes = SETTINGS_ROUTE_SCOPES[routeName];
  if (!scopes || !ctx.access.known) return false;
  return hasScope(ctx.access, scopes, 'all');
}

/** El hub se abre si TMWE, si hay al menos una tarjeta que la persona pueda abrir por
 *  scope, o si existe alguna ruta abierta a cualquiera (SETTINGS_ROUTES_OPEN_TO_ANY_USER):
 *  esa tarjeta sola ya justifica entrar, sin exigir ningún scope de personal. */
export function canEnterSettingsHub(ctx: AccessContext): boolean {
  if (ctx.isAdmin === true) return true;
  if (SETTINGS_ROUTES_OPEN_TO_ANY_USER.size > 0) return true;
  return Object.keys(SETTINGS_ROUTE_SCOPES).some((name) => canOpenAdminRoute(name, ctx));
}
