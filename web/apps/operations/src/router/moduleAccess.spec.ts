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

  // Operador de partner sin administración (recorrido 2026-11-04) frente al administrador con cobros y SMTP.
  const partnerOperator = known(["contacts:read", "crm:read", "invoices:read", "shipment:read", "tracking:read", "erp:view"]);
  const partnerAdminFull = known([...partnerOperator.scopes, "payments:read", "smtp:read", "partner:manage"]);

  it("cobros, pasarelas, reembolsos y SMTP: el operador no entra, el administrador sí", () => {
    for (const name of ["payments", "payments-aging", "payments-reminders", "settings-pay-gateways", "settings-pay-refunds", "settings-partner-smtp"]) {
      expect(canOpenModuleRoute(name, { isAdmin: false, access: partnerOperator })).toBe(false);
      expect(canOpenModuleRoute(name, { isAdmin: false, access: partnerAdminFull })).toBe(true);
    }
  });

  it("la importación masiva exige import:* (ningún rol de partner lo lleva)", () => {
    expect(canOpenModuleRoute("bulk", { isAdmin: false, access: partnerAdminFull })).toBe(false);
    expect(canOpenModuleRoute("bulk", { isAdmin: false, access: known(["import:write"]) })).toBe(true);
    expect(canOpenModuleRoute("bulk", { isAdmin: true, access: partnerAdminFull })).toBe(true);
  });

  it("el menú: tracking solo TMWE, cobros con payments:read, importación con import:*", () => {
    const items = NAV_SECTION_DEFS.flatMap((s) => s.items);
    const find = (key: string) => items.find((i) => i.key === key)!;
    expect(isNavEntryVisible(find("tracking"), false, partnerAdminFull)).toBe(false);
    expect(isNavEntryVisible(find("tracking"), true, partnerOperator)).toBe(true);
    expect(isNavEntryVisible(find("payments"), false, partnerOperator)).toBe(false);
    expect(isNavEntryVisible(find("payments"), false, partnerAdminFull)).toBe(true);
    expect(isNavEntryVisible(find("bulk"), false, partnerAdminFull)).toBe(false);
  });

  it("firmas de entrega exigen el módulo driver; plantillas, config:read o partner:manage", () => {
    expect(canOpenModuleRoute("warehouse-deliveries", { isAdmin: false, access: partnerAdminFull })).toBe(false);
    expect(canOpenModuleRoute("warehouse-deliveries", { isAdmin: false, access: known(["driver:read"]) })).toBe(true);
    expect(canOpenModuleRoute("email_templates", { isAdmin: false, access: partnerOperator })).toBe(false);
    expect(canOpenModuleRoute("email_templates", { isAdmin: false, access: partnerAdminFull })).toBe(true);
    expect(canOpenModuleRoute("email_templates", { isAdmin: false, access: known(["config:read"]) })).toBe(true);
  });
});
