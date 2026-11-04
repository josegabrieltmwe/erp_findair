import { describe, expect, it } from "vitest";
import { NAV_SECTION_DEFS, isNavEntryVisible } from "@shared/platform/navCatalog";
import { canOpenModuleRoute } from "./moduleAccess";

const known = (scopes: string[]) => ({ roles: [], scopes, isRoot: false, known: true });
const unknown = { roles: [], scopes: [], isRoot: false, known: false };

describe("canOpenModuleRoute (H15)", () => {
  it("COD se decide por el modulo spedizioni, no por facturacion", () => {
    expect(canOpenModuleRoute("cod", { isAdmin: false, access: known(["shipment:read"]) })).toBe(true);
    expect(canOpenModuleRoute("cod", { isAdmin: false, access: known(["courier:read"]) })).toBe(true);
    // tener facturacion no basta para COD
    expect(canOpenModuleRoute("cod", { isAdmin: false, access: known(["invoices:read", "invoices:write"]) })).toBe(false);
  });

  it("proforma exige invoices:read", () => {
    expect(canOpenModuleRoute("proforma", { isAdmin: false, access: known(["invoices:read"]) })).toBe(true);
    expect(canOpenModuleRoute("proforma", { isAdmin: false, access: known(["shipment:read"]) })).toBe(false);
  });

  it("TMWE pasa siempre y sin 'access' conocido falla abierto", () => {
    expect(canOpenModuleRoute("cod", { isAdmin: true, access: known([]) })).toBe(true);
    expect(canOpenModuleRoute("cod", { isAdmin: false, access: unknown })).toBe(true);
  });

  it("rutas sin regla pasan", () => {
    expect(canOpenModuleRoute("home", { isAdmin: false, access: known([]) })).toBe(true);
  });

  // Scopes reales del administrador de partner del recorrido (get_my_profile, 2026-11-04): sin giacenze, pickups ni driver.
  const partnerAdmin = known(["contacts:read", "crm:read", "invoices:read", "listini:read", "shipment:read", "tracking:read"]);

  it("giacenze, pickups, POD y giro del autista se cierran sin el scope del módulo", () => {
    const rules: Record<string, string> = {
      giacenze: "inventory:read",
      pickup: "pickups:read",
      "pickup-list": "pickups:read",
      "pickup-calendar": "pickups:read",
      "pickup-pod": "driver:write",
      "warehouse-driver-load": "driver:read",
    };
    for (const [name, scope] of Object.entries(rules)) {
      expect(canOpenModuleRoute(name, { isAdmin: false, access: partnerAdmin })).toBe(false);
      expect(canOpenModuleRoute(name, { isAdmin: false, access: known([scope]) })).toBe(true);
      expect(canOpenModuleRoute(name, { isAdmin: true, access: partnerAdmin })).toBe(true);
    }
  });

  it("el menú esconde giacenze y pickup al partner sin el scope", () => {
    const items = NAV_SECTION_DEFS.flatMap((s) => s.items);
    for (const [key, scope] of [["giacenze", "inventory:read"], ["pickup", "pickups:read"]]) {
      const it = items.find((i) => i.key === key)!;
      expect(isNavEntryVisible(it, false, partnerAdmin)).toBe(false);
      expect(isNavEntryVisible(it, false, known([scope]))).toBe(true);
      expect(isNavEntryVisible(it, true, partnerAdmin)).toBe(true);
    }
  });
});
