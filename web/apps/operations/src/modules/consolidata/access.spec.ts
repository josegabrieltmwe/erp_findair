import { describe, expect, it } from "vitest";
import {
  NAV_SECTION_DEFS,
  isNavEntryVisible,
} from "@shared/platform/navCatalog";
import { canOpenModuleRoute } from "@/router/moduleAccess";

/** Acceso a consolidata por el scope `consolidation:manage` (rol consolidation_manager, 2026-11-03). */
const entry = NAV_SECTION_DEFS.flatMap((s) => s.items).find(
  (it) => it.key === "consolidata",
)!;
const withScope = {
  known: true,
  scopes: ["consolidation:manage"],
  roles: [],
  isRoot: false,
};
const withoutScope = {
  known: true,
  scopes: ["shipment:read"],
  roles: [],
  isRoot: false,
};
const unknown = { known: false, scopes: [], roles: [], isRoot: false };

describe("acceso a consolidata", () => {
  it("el menú ya no es solo de TMWE: lo da el scope", () => {
    expect(entry.adminOnly).toBeFalsy();
    expect(entry.scopes).toEqual(["consolidation:manage"]);
  });

  it("menú: TMWE siempre, partner con el scope sí, sin el scope no", () => {
    expect(isNavEntryVisible(entry, true, withoutScope)).toBe(true);
    expect(isNavEntryVisible(entry, false, withScope)).toBe(true);
    expect(isNavEntryVisible(entry, false, withoutScope)).toBe(false);
  });

  it("menú: sin `access` informado se muestra y decide el servidor", () => {
    expect(isNavEntryVisible(entry, false, unknown)).toBe(true);
    expect(isNavEntryVisible(entry, false)).toBe(true);
  });

  it("rutas: todas las de consolidata exigen el scope salvo a TMWE", () => {
    for (const name of [
      "consolidata",
      "consolidata-list",
      "consolidata-quote",
      "consolidata-detail",
    ]) {
      expect(
        canOpenModuleRoute(name, { isAdmin: false, access: withScope }),
      ).toBe(true);
      expect(
        canOpenModuleRoute(name, { isAdmin: false, access: withoutScope }),
      ).toBe(false);
      expect(
        canOpenModuleRoute(name, { isAdmin: true, access: withoutScope }),
      ).toBe(true);
    }
  });
});
