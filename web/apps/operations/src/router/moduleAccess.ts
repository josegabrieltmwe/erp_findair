/**
 * Guard de UX por módulo para rutas sin `requiresAdmin`: se decide con los scopes reales del token
 * (`get_my_profile.access`), NO con las capacidades de facturación (`__TMWE_INVOICING__`), que son de
 * otro módulo. La API autoriza cada petición igualmente (H15 del plan de mitigación).
 *
 * Correspondencia (`Module_Permission_Service::SCOPE_MODULE_MAP` en tmwe_api):
 *   - COD: el servidor lo autoriza con el módulo `spedizioni` (`shipment:read` o el estrecho `courier:read`).
 *   - Proforma: módulo `proforma` (`invoices:read`).
 *   - Consolidata: scope transversal `consolidation:manage` (rol aditivo consolidation_manager).
 *   - Giacenze: módulo `giacenze` (`inventory:read`); pickups: módulo `pickups` (`pickups:read`); POD y giro del
 *     autista: módulo `driver` (`driver:write` / `driver:read`).
 *   - Importación masiva: `shipment_import` (`import:*`); cobros: `pagamenti` (`payments:read`);
 *     pasarelas, reembolsos y cobro online: módulo `payment_gateways` (`payment_gateways:read|write|admin`); SMTP del partner: `partner_smtp` (`smtp:read`).
 *
 * Falla ABIERTO cuando el perfil no informa `access` (backend antiguo o perfil no cargado): el servidor
 * responde 403 igualmente y esconder una pantalla por no saber sería peor que mostrarla vacía.
 */
import { hasScope, type AccessSnapshot } from "@shared/composables/useAccess";

export const MODULE_ROUTE_SCOPES: Readonly<Record<string, readonly string[]>> = {
  cod: ["shipment:read", "courier:read"],
  "cod-reconciliation": ["shipment:read", "courier:read"],
  proforma: ["invoices:read"],
  // Consolidata (2026-11-03): TMWE y partners con el rol consolidation_manager.
  consolidata: ["consolidation:manage"],
  "consolidata-list": ["consolidation:manage"],
  "consolidata-quote": ["consolidation:manage"],
  "consolidata-detail": ["consolidation:manage"],
  // Recorrido por perfiles (2026-11-04): el partner admin abría estas pantallas y el API respondía 403 en todas
  // sus llamadas. Mismos scopes que exige cada controller (SCOPE_MODULE_MAP).
  giacenze: ["inventory:read"], // api_inventory_crud, api_giacenze_aging → módulo giacenze
  pickup: ["pickups:read"], // api_operations_panel → módulo pickups
  "pickup-list": ["pickups:read"], // api_pickups_crud
  "pickup-calendar": ["pickups:read"], // api_pickup_calendar
  "pickup-pod": ["driver:write"], // POST api_driver_pod → módulo driver
  "warehouse-driver-load": ["driver:read"], // api_driver_routes → módulo driver
  // Operador de partner sin administración (2026-11-04): mismas pantallas abiertas con 403 en el API.
  bulk: ["import:read", "import:write"], // api_bulk_import → módulo shipment_import
  payments: ["payments:read"], // api_payments, api_payment_methods → módulo pagamenti
  "payments-aging": ["payments:read"], // api_payment_aging
  "payments-reminders": ["payments:read"], // api_dunning
  "payments-reconciliation": ["payments:read"],
  "settings-pay-gateways": ["payment_gateways:read"], // api_pay_gateway_accounts → módulo payment_gateways
  "settings-pay-refunds": ["payment_gateways:read"], // api_pay_refunds → módulo payment_gateways
  // Recargos y autorizaciones de cobro (Ola 3 / F-C): leer exige payment_gateways:read (api_pay_surcharges y
  // api_pay_authorizations → módulo payment_gateways). Proponer/avisar/alta/revocar (:write) y perdonar/rechazar/cobrar
  // (:admin) NO cierran la ruta: se ocultan sus botones, porque quien solo lee sigue pudiendo ver el estado.
  "payments-surcharges": ["payment_gateways:read"],
  "payments-authorizations": ["payment_gateways:read"],
  // La vista admin (settings-pay-gateways-admin) no se mapea: es `requiresAdmin` (solo TMWE; payment_gateways:admin lo
  // exige el API en api_admin_pay_gateway_accounts) y TMWE pasa siempre este guard.
  "settings-partner-smtp": ["smtp:read"], // api_partner_smtp → módulo partner_smtp
  // Firmas de entrega: la búsqueda (api_driver_delivery) y la firma (api_driver_pod) son del módulo driver.
  "warehouse-deliveries": ["driver:read", "driver:write"],
  // Plantillas de correo: master_data (config:read) o el administrador del partner, las suyas (partner:manage).
  email_templates: ["config:read", "partner:manage"],
};

/**
 * Rutas que exigen TODOS los scopes de su lista (semántica AND), a diferencia de `MODULE_ROUTE_SCOPES` (basta uno).
 * Existe porque algunas rutas cruzan dos módulos del API y este rechaza con 403 si falta cualquiera de los dos; con
 * «cualquiera» la pantalla se abriría para quien solo tiene uno y todas sus llamadas fallarían.
 *   - `payments-pending-invoices`: `GET api_pay_pending_invoices` exige `invoices:read` (qué facturas se ven) Y
 *     `payment_gateways:read` (la fila indica si hay un cobro en curso). No se crea ningún scope ni se amplía ningún rol.
 */
export const MODULE_ROUTE_ALL_SCOPES: Readonly<Record<string, readonly string[]>> = {
  "payments-pending-invoices": ["invoices:read", "payment_gateways:read"],
};

/** ¿La ruta tiene guard de módulo (de cualquiera de los dos mapas)? El router lo usa para decidir si resuelve el perfil. */
export function isModuleGuardedRoute(routeName: string): boolean {
  return routeName in MODULE_ROUTE_SCOPES || routeName in MODULE_ROUTE_ALL_SCOPES;
}

/**
 * ¿Puede la persona abrir la ruta de módulo? TMWE siempre; con perfil sin `access` falla abierto (el API decide);
 * si no, se comprueba «alguno» (`MODULE_ROUTE_SCOPES`) o «todos» (`MODULE_ROUTE_ALL_SCOPES`). Sin entrada: libre.
 */
export function canOpenModuleRoute(
  routeName: string,
  ctx: { isAdmin: boolean | null; access: AccessSnapshot },
): boolean {
  const anyScopes = MODULE_ROUTE_SCOPES[routeName];
  const allScopes = MODULE_ROUTE_ALL_SCOPES[routeName];
  if (!anyScopes && !allScopes) return true;
  if (ctx.isAdmin === true) return true; // TMWE (anagrafica 1): el servidor lo deja pasar siempre
  if (!ctx.access.known) return true;
  if (anyScopes && !hasScope(ctx.access, anyScopes, "any")) return false;
  if (allScopes && !hasScope(ctx.access, allScopes, "all")) return false;
  return true;
}
