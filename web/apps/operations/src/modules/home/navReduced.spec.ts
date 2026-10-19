import { describe, expect, it } from "vitest";
import {
  NAV_SECTION_DEFS,
  hasHiddenNavEntries,
  reduceNavSections,
  visibleNavSections,
} from "@shared/platform/navCatalog";

const keys = (s: { items: { key: string }[] }[]): string[] => s.flatMap((x) => x.items.map((i) => i.key));
const partner = visibleNavSections(NAV_SECTION_DEFS, false);

describe("menú reducido del partner", () => {
  it("por defecto solo deja los accesos del trabajo diario", () => {
    const reduced = reduceNavSections(partner, false);
    expect(keys(reduced)).toEqual(["home", "cargo", "shipment", "tracking", "giacenze", "pickup", "clients", "invoicing", "price_lists"]);
  });

  it("«Ver más» devuelve todos los accesos que el partner puede ver", () => {
    expect(keys(reduceNavSections(partner, true))).toEqual(keys(partner));
  });

  it("mantiene el acceso de la pantalla actual aunque no sea diario", () => {
    const reduced = reduceNavSections(partner, false, new Set(["crm"]));
    expect(keys(reduced)).toContain("crm");
    expect(keys(reduced)).not.toContain("copilot");
  });

  it("descarta las secciones que quedan vacías", () => {
    const reduced = reduceNavSections(partner, false);
    expect(reduced.every((s) => s.items.length > 0)).toBe(true);
    expect(reduced.map((s) => s.sectionKey)).not.toContain("mi_organizacion");
  });

  it("el partner ve nombres en lenguaje llano en cargo, retenciones y clientes", () => {
    const named = partner.flatMap((x) => x.items).filter((i) => i.partnerKey).map((i) => i.key);
    expect(named).toEqual(["cargo", "giacenze", "clients"]);
  });

  it("sabe si la vista reducida oculta algo", () => {
    expect(hasHiddenNavEntries(partner)).toBe(true);
    const onlyDaily = partner.map((s) => ({ ...s, items: s.items.filter((i) => i.daily) }));
    expect(hasHiddenNavEntries(onlyDaily)).toBe(false);
  });

  it("no oculta nada al personal TMWE: la reducción solo se aplica a partners", () => {
    const admin = visibleNavSections(NAV_SECTION_DEFS, true);
    expect(keys(admin)).toContain("consolidata");
    expect(keys(admin)).not.toContain("price_lists");
  });
});

describe("i18n del menú en los cinco idiomas", () => {
  const LOCALES = ["es", "it", "en", "de", "nl"];
  const entries = NAV_SECTION_DEFS.flatMap((s) => s.items);
  const keysI18n = [...new Set(entries.flatMap((i) => [i.key, i.partnerKey].filter((k): k is string => !!k)))];

  it.each(LOCALES)("«%s» tiene nombre para cada acceso, partnerKey y sección", async (lang) => {
    const mod = await import(`../../locales/${lang}.json`);
    const opsnav = (mod.default ?? mod).platform?.opsnav ?? {};
    const missing = keysI18n.filter((k) => typeof opsnav[k] !== "string" || opsnav[k] === "");
    const missingSections = NAV_SECTION_DEFS.map((s) => s.sectionKey)
      .filter((k) => typeof opsnav.sections?.[k] !== "string");
    expect({ missing, missingSections }).toEqual({ missing: [], missingSections: [] });
    for (const k of ["show_more", "show_less"]) expect(typeof opsnav[k]).toBe("string");
  });
});
