import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HOME_KPI_CATALOG } from "@shared/dashboard/home_kpi_catalog";
import {
  TODAY_GROUPS,
  TODAY_TILES,
  countGiacenze,
  countOverdueCustomers,
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
  it("giacenze: avisar al cliente, instrucciones al proveedor y más de 15 días", () => {
    const now = Date.parse("2026-11-12T10:00:00");
    const rows = [
      {
        data_open: "2026-10-01 09:00:00",
        data_close: null,
        cont_cliente_data: null,
      }, // sin avisar, >15 d
      {
        data_open: "2026-11-10 09:00:00",
        data_close: "0000-00-00",
        cont_cliente_data: "2026-11-11",
        risp_cliente_data: "2026-11-11",
        cont_fornitore_data: null,
      }, // cliente respondió, proveedor sin instrucciones
      {
        data_open: "2026-10-01",
        data_close: "2026-10-20",
        cont_cliente_data: null,
      }, // cerrada: no cuenta
      {
        data_open: "2026-11-01",
        data_close: null,
        cont_cliente_data: "2026-11-02",
        risp_cliente_data: "2026-11-03",
        cont_fornitore_data: "2026-11-04",
      }, // proveedor ya avisado después
    ];
    expect(countGiacenze(rows, now)).toEqual({
      giac_dacom: 1,
      giac_forn: 1,
      giac15: 1,
    });
  });

  it("cobros: clientes distintos con saldo vencido > 0, ignorando pagos y cerradas", () => {
    const rows = [
      {
        id_anagrafica: 1,
        importo: 100,
        scadenza: "2026-10-01",
        data_close: "0000-00-00",
        tipo: "A",
      },
      {
        id_anagrafica: 1,
        importo: 50,
        scadenza: "2026-10-05",
        data_close: null,
        tipo: "A",
      },
      {
        id_anagrafica: 2,
        importo: 80,
        scadenza: "2026-12-01",
        data_close: null,
        tipo: "A",
      }, // no vencida
      {
        id_anagrafica: 3,
        importo: 80,
        scadenza: "2026-10-01",
        data_close: "2026-10-10",
        tipo: "A",
      }, // cobrada
      {
        id_anagrafica: 4,
        importo: 80,
        scadenza: "2026-10-01",
        data_close: null,
        tipo: "P",
      }, // pago a proveedor
      {
        id_anagrafica: 5,
        importo: 0,
        scadenza: "2026-10-01",
        data_close: null,
        tipo: "A",
      }, // saldo 0
    ];
    expect(countOverdueCustomers(rows, "2026-11-12")).toBe(1);
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
