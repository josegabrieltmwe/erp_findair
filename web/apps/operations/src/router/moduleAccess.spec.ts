import { describe, expect, it } from "vitest";
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
});
