/**
 * Guard de UX por módulo para rutas sin `requiresAdmin`: se decide con los scopes reales del token
 * (`get_my_profile.access`), NO con las capacidades de facturación (`__TMWE_INVOICING__`), que son de
 * otro módulo. La API autoriza cada petición igualmente (H15 del plan de mitigación).
 *
 * Correspondencia (`Module_Permission_Service::SCOPE_MODULE_MAP` en tmwe_api):
 *   - COD: el servidor lo autoriza con el módulo `spedizioni` (`shipment:read` o el estrecho `courier:read`).
 *   - Proforma: módulo `proforma` (`invoices:read`).
 *   - Consolidata: scope transversal `consolidation:manage` (rol aditivo consolidation_manager).
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
