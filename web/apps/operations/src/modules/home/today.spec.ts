import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HOME_KPI_CATALOG } from "@shared/dashboard/home_kpi_catalog";
import {
  TODAY_GROUPS,
  TODAY_TILES,
  countRequests,
  isCountOnly,
  isZeroTile,
  resolveTile,
  todayCategories,
  visibleTodayTiles,
  type ResolveContext,
  type TodayTile,
} from "@shared/dashboard/today_catalog";
import { totalOf } from "@shared/dashboard/today_special.service";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const LOCALES = ["de", "en", "es", "it", "nl"] as const;
const tile = (key: string): TodayTile =>
  TODAY_TILES.find((t) => t.key === key)!;
const ctx = (over: Partial<ResolveContext> = {}): ResolveContext => ({
  counts: {},
  pending: new Set(),
  errors: {},
  special: {},
  cached: {},
  ...over,
});

describe("catálogo «Da fare oggi»", () => {
  it("las claves son únicas y cada grupo existe", () => {
    const keys = TODAY_TILES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TODAY_TILES) expect(TODAY_GROUPS).toContain(t.group);
  });

  it("las tarjetas del catálogo existen en el catálogo de KPI y enlazan a su mismo preset", () => {
    for (const t of TODAY_TILES.filter((x) => x.source === "catalog")) {
      const kpi = HOME_KPI_CATALOG.find((k) => k.key === t.key);
      expect(kpi, t.key).toBeDefined();
      expect(t.link.page, t.key).toBe(kpi!.link.page);
      expect(t.link.query, t.key).toEqual(kpi!.link.query);
    }
  });

  it("todo destino existe en el router", () => {
    const router = readFileSync(here("../../router/index.ts"), "utf8");
    const names = new Set(
      [...router.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]),
    );
    for (const t of TODAY_TILES)
      expect(names.has(t.link.page), `${t.key} → ${t.link.page}`).toBe(true);
  });

  it("pide solo las categorías del cockpit que alimentan sus tarjetas", () => {
    expect(todayCategories().sort()).toEqual([
      "assist",
      "cargo_lifecycle",
      "courier_ops_in",
    ]);
  });

  it("sin scope no se muestra la pantalla de destino; sin perfil falla abierto", () => {
    const partner = { scopes: ["shipment:read"], known: true };
    const keys = visibleTodayTiles(partner).map((t) => t.key);
    expect(keys).not.toContain("incassare");
    expect(keys).not.toContain("giac15");
    expect(keys).toContain("dacontr");
    expect(visibleTodayTiles({ scopes: [], known: false }).length).toBe(
      TODAY_TILES.length,
    );
    expect(
      visibleTodayTiles({ scopes: [], known: true, isRoot: true }).length,
    ).toBe(TODAY_TILES.length);
  });
});

describe("estado de una tarjeta", () => {
  it("con el dato del cockpit está lista; a 0 se oculta", () => {
    const r = resolveTile(tile("dacontr"), ctx({ counts: { dacontr: 0 } }));
    expect(r).toEqual({ state: "ready", value: 0, stale: false });
    expect(isZeroTile(tile("dacontr"), r)).toBe(true);
  });

  it("sin dato y con la categoría en vuelo está cargando, y no se oculta", () => {
    const r = resolveTile(
      tile("dacontr"),
      ctx({ pending: new Set(["courier_ops_in"]) }),
    );
    expect(r.state).toBe("loading");
    expect(isZeroTile(tile("dacontr"), r)).toBe(false);
  });

  it("si la fuente falla es «n/d», nunca 0 (y no se oculta)", () => {
    const r = resolveTile(
      tile("dacontr"),
      ctx({ errors: { courier_ops_in: "boom" } }),
    );
    expect(r).toEqual({ state: "unavailable", value: null, stale: false });
    expect(isZeroTile(tile("dacontr"), r)).toBe(false);
    const sp = resolveTile(tile("resi"), ctx({ special: { resi: null } }));
    expect(sp.state).toBe("unavailable");
  });

  it("mientras llega el dato fresco enseña el último valor bueno, y ese no se oculta aunque sea 0", () => {
    const r = resolveTile(tile("resi"), ctx({ cached: { resi: 0 } }));
    expect(r).toEqual({ state: "loading", value: 0, stale: true });
    expect(isZeroTile(tile("resi"), r)).toBe(false);
    const failed = resolveTile(
      tile("resi"),
      ctx({ special: { resi: null }, cached: { resi: 7 } }),
    );
    expect(failed).toEqual({ state: "unavailable", value: 7, stale: true });
  });

  it("una tarjeta sin número está siempre lista y nunca se oculta", () => {
    const r = resolveTile(tile("dafatt"), ctx());
    expect(r.state).toBe("ready");
    expect(isZeroTile(tile("dafatt"), r)).toBe(false);
  });
});

describe("contadores especiales", () => {
  it("la home solo pide conteos: ninguna petición trae una página de datos", () => {
    for (const [key, req] of Object.entries(countRequests()))
      expect(isCountOnly(req), key).toBe(true);
  });

  it("cubre todas las tarjetas especiales que se leen de un listado", () => {
    const keys = Object.keys(countRequests());
    const listed = TODAY_TILES.filter(
      (t) => t.source === "special" && !t.key.startsWith("chat_"),
    ).map((t) => t.key);
    expect(keys.sort()).toEqual(listed.sort());
  });

  it("giacenze: filtros de servidor (abiertas / cliente sin avisar / respuesta sin instrucciones / más de 15 días)", () => {
    const r = countRequests(new Date(2026, 10, 12, 10, 0, 0));
    expect(r.giac_dacom.query).toMatchObject({
      data_close_flag: "N",
      cont_cliente: "N",
    });
    expect(r.giac_forn.query).toMatchObject({
      data_close_flag: "N",
      risp_cliente: "S",
      cont_fornitore: "N",
    });
    expect(r.giac15.query).toMatchObject({
      data_close_flag: "N",
      data_open_a: "2026-10-28",
    });
    for (const k of ["giac_dacom", "giac_forn", "giac15"])
      expect(r[k].path).toBe("/api_inventory_crud");
  });

  it("cobros: cuotas de clientes vencidas y abiertas, en una sola consulta de conteo", () => {
    expect(countRequests().incassare).toEqual({
      path: "/api_payments",
      query: { tipo: "A", statop: "SC", per_page: "1" },
    });
  });

  it("el total del listado es obligatorio: sin él falla (n/d) en vez de inventar 0", () => {
    expect(totalOf({ pagination: { total: "12" } })).toBe(12);
    expect(() => totalOf({ pagination: {} })).toThrow();
    expect(() => totalOf(null)).toThrow();
  });
});

describe("traducciones de «Da fare oggi»", () => {
  const load = (l: string) =>
    JSON.parse(readFileSync(here(`./locales/${l}.json`), "utf8")).home.today;

  it("existen en los 5 idiomas, para todos los grupos y todas las tarjetas", () => {
    for (const l of LOCALES) {
      const d = load(l);
      for (const k of ["title", "all_groups", "error", "list_approximate"])
        expect(String(d[k] ?? "").trim().length, `${l}.${k}`).toBeGreaterThan(
          0,
        );
      for (const g of TODAY_GROUPS)
        expect(
          String(d.group[g] ?? "").trim().length,
          `${l}.group.${g}`,
        ).toBeGreaterThan(0);
      for (const t of TODAY_TILES) {
        expect(
          String(d.tile[t.key]?.label ?? "").trim().length,
          `${l}.${t.key}.label`,
        ).toBeGreaterThan(0);
        expect(
          String(d.tile[t.key]?.desc ?? "").trim().length,
          `${l}.${t.key}.desc`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("no hay textos de más: cada tarjeta traducida existe en el catálogo", () => {
    const keys = new Set(TODAY_TILES.map((t) => t.key));
    for (const l of LOCALES)
      for (const k of Object.keys(load(l).tile))
        expect(keys.has(k), `${l}.${k}`).toBe(true);
  });
});
