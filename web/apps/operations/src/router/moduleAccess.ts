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
};

export function canOpenModuleRoute(
  routeName: string,
  ctx: { isAdmin: boolean | null; access: AccessSnapshot },
): boolean {
  const scopes = MODULE_ROUTE_SCOPES[routeName];
  if (!scopes) return true;
  if (ctx.isAdmin === true) return true; // TMWE (anagrafica 1): el servidor lo deja pasar siempre
  if (!ctx.access.known) return true;
  return hasScope(ctx.access, scopes, "any");
}
