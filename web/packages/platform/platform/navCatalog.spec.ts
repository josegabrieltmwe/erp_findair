import { describe, expect, it } from "vitest";
import { navKeyForRoute } from "./navCatalog";

/**
 * Collaudo 14/11: OperationsShell asumía key === routeName para traducir el título de la
 * topbar; solo coincidía por casualidad en "home". navKeyForRoute() es la fuente única
 * (el mismo NAV_SECTION_DEFS que pinta el menú lateral).
 */
describe("navKeyForRoute", () => {
  it("resuelve la clave del menú para las rutas con entrada dedicada", () => {
    expect(navKeyForRoute("home")).toBe("home");
    expect(navKeyForRoute("anagrafiche")).toBe("clients");
    expect(navKeyForRoute("price-lists")).toBe("price_lists");
    expect(navKeyForRoute("warehouse-weighing")).toBe("warehouse");
  });

  it("undefined para una ruta sin entrada de menú (p. ej. una sub-página)", () => {
    expect(navKeyForRoute("warehouse-docpack")).toBeUndefined();
    expect(navKeyForRoute("no-existe")).toBeUndefined();
  });
});
