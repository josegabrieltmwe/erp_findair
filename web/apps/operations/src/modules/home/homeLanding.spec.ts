import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NAV_SECTION_DEFS, isNavEntryVisible, visibleNavSections } from "@shared/platform/navCatalog";
import { indicatorGroupsFromCatalog } from "@shared/dashboard/cockpit.store";
import { HOME_KPI_CATALOG } from "@shared/dashboard/home_kpi_catalog";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const ES = JSON.parse(readFileSync(here("./locales/es.json"), "utf8"));
const LOCALES = ["de", "en", "es", "it", "nl"] as const;

describe("catálogo de navegación (menú y home comparten fuente)", () => {
  it("el admin ve herramientas de admin y no ve lo exclusivo del partner", () => {
    const keys = visibleNavSections(NAV_SECTION_DEFS, true).flatMap((s) => s.items.map((i) => i.key));
    expect(keys).toContain("settings");
    expect(keys).not.toContain("my_org_users");
    expect(keys).not.toContain("price_lists");
  });

  it("el partner ve lo suyo y no ve admin", () => {
    const keys = visibleNavSections(NAV_SECTION_DEFS, false).flatMap((s) => s.items.map((i) => i.key));
    expect(keys).toContain("my_org_users");
    expect(keys).toContain("price_lists");
    expect(keys).not.toContain("settings");
    expect(keys).not.toContain("api_portal");
  });

  it("no deja secciones vacías", () => {
    for (const admin of [true, false]) {
      for (const s of visibleNavSections(NAV_SECTION_DEFS, admin)) expect(s.items.length).toBeGreaterThan(0);
    }
  });

  it("isNavEntryVisible aplica adminOnly y partnerOnly", () => {
    expect(isNavEntryVisible({ adminOnly: true }, false)).toBe(false);
    expect(isNavEntryVisible({ partnerOnly: true }, true)).toBe(false);
    expect(isNavEntryVisible({}, true)).toBe(true);
    expect(isNavEntryVisible({}, false)).toBe(true);
  });

  it("todo routeName del catálogo existe en el router (un acceso roto no llega a la home)", () => {
    const router = readFileSync(here("../../router/index.ts"), "utf8");
    const names = new Set([...router.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]));
    const missing = NAV_SECTION_DEFS.flatMap((s) => s.items)
      .filter((it) => it.routeName && !names.has(it.routeName))
      .map((it) => it.routeName);
    expect(missing).toEqual([]);
  });

  it("la home y las actividades tienen su ruta, y las acciones de crear existen", () => {
    const router = readFileSync(here("../../router/index.ts"), "utf8");
    for (const name of ["home", "home-activities", "cargo-new", "shipment-new"]) {
      expect(router).toContain(`name: "${name}"`);
    }
  });
});

describe("indicadores que pide la vista de actividades", () => {
  const groups = indicatorGroupsFromCatalog();
  const requested = Object.values(groups).flat();

  it("solo pide indicadores que algún tile muestra", () => {
    const shown = new Set(HOME_KPI_CATALOG.filter((k) => k.countSource === "indicators").map((k) => k.key));
    for (const id of requested) expect(shown.has(id)).toBe(true);
  });

  it("todo tile alimentado por indicadores está en alguna petición", () => {
    for (const k of HOME_KPI_CATALOG.filter((k) => k.countSource === "indicators")) {
      expect(requested).toContain(k.key);
    }
  });

  it("no pide indicadores sin tile ni el de pesaje (mal definido)", () => {
    for (const id of ["active_customers_month", "new_contacts_month", "parcels_to_weigh", "prep_logistica", "pending_pickups"]) {
      expect(requested).not.toContain(id);
    }
  });

  it("no hay grupos vacíos", () => {
    for (const ids of Object.values(groups)) expect(ids.length).toBeGreaterThan(0);
  });
});

describe("traducciones de la home", () => {
  const KEYS = Object.keys(ES.home.landing).sort();

  it("el botón y los textos existen en los 5 idiomas con las mismas claves", () => {
    for (const l of LOCALES) {
      const d = JSON.parse(readFileSync(here(`./locales/${l}.json`), "utf8"));
      expect(Object.keys(d.home.landing).sort(), l).toEqual(KEYS);
      for (const k of KEYS) expect(String(d.home.landing[k]).trim().length, `${l}.${k}`).toBeGreaterThan(0);
    }
  });

  it("el botón 'Actividades del día' está traducido (no es el mismo texto en todos)", () => {
    const texts = LOCALES.map((l) => JSON.parse(readFileSync(here(`./locales/${l}.json`), "utf8")).home.landing.activities_button);
    expect(new Set(texts).size).toBe(LOCALES.length);
  });

  it("las claves home.home.cta que usa la landing existen en los 5 idiomas", () => {
    for (const l of LOCALES) {
      const d = JSON.parse(readFileSync(here(`./locales/${l}.json`), "utf8"));
      for (const k of ["new_cargo", "new_cargo_sub", "new_shipment", "new_shipment_sub"]) {
        expect(d.home.home.cta[k], `${l}.${k}`).toBeTruthy();
      }
    }
  });
});
