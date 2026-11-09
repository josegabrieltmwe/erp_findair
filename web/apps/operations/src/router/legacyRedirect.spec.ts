import { describe, expect, it } from "vitest";
import { resolveLegacyUrl } from "./legacyRedirect";

const go = (path: string, hash = "", query: Record<string, string> = {}) => resolveLegacyUrl({ path, hash, query });

describe("resolveLegacyUrl", () => {
  it("abre el listado del CRM con su filtro", () => {
    expect(go("/erp/tmwe_json/crm_pratica", "#/pratiche?ti=open")).toEqual({ path: "/crm", query: { ti: "open" }, hash: "" });
  });

  it("abre la ficha de una pratica", () => {
    expect(go("/erp/tmwe_json/crm_pratica", "#/pratiche/9")).toMatchObject({ path: "/crm/pratiche/9" });
    expect(go("/erp/tmwe_json/ops/crm/pratiche/9")).toMatchObject({ path: "/crm/pratiche/9" });
  });

  it("traduce la hash history de operations", () => {
    expect(go("/erp/tmwe_json/operations", "#/giacenze?id=7")).toEqual({ path: "/giacenze", query: { id: "7" }, hash: "" });
    expect(go("/erp/tmwe_json/operations", "#/shipment/5")).toMatchObject({ path: "/shipment/5" });
  });

  it("quita los prefijos antiguos y conserva la query", () => {
    expect(go("/erp/tmwe_json/ops/cargo/5", "", { tab: "a" })).toEqual({ path: "/cargo/5", query: { tab: "a" }, hash: "" });
    expect(go("/ops/shipment/5")).toMatchObject({ path: "/shipment/5" });
  });

  it("traduce las páginas que cambiaron de nombre", () => {
    expect(go("/erp/tmwe_json/cod_assegni")).toMatchObject({ path: "/cod" });
    expect(go("/erp/tmwe_json/pickup_manager")).toMatchObject({ path: "/pickup" });
    expect(go("/erp/tmwe_json/invoicing/list")).toMatchObject({ path: "/invoicing" });
  });

  it("sin página va a la raíz", () => {
    expect(go("/ops")).toMatchObject({ path: "/" });
    expect(go("/erp/tmwe_json")).toMatchObject({ path: "/" });
  });
});
