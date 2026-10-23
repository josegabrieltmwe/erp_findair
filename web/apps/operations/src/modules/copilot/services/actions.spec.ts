import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  COPILOT_ROUTE_NAMES,
  periodRange,
  resolveAction,
  runActions,
} from "./actions";

const NOW = new Date(2026, 9, 23, 10, 0, 0); // Fri 2026-10-23

describe("mapeo de acciones del copilot", () => {
  it("cada nombre de la lista cerrada existe en el router de la SPA", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../../router/index.ts", import.meta.url)),
      "utf8",
    );
    for (const name of COPILOT_ROUTE_NAMES) {
      expect(src, `falta la ruta ${name}`).toContain(`name: "${name}"`);
    }
    expect(COPILOT_ROUTE_NAMES.sort()).toEqual(
      [
        "cargo-detail",
        "cargo-list",
        "cargo-new",
        "shipment-detail",
        "shipment-list",
        "shipment-new",
        "tracking",
      ].sort(),
    );
  });

  it("rutas sin parametros", () => {
    for (const route of ["tracking", "shipment-new", "cargo-new"]) {
      expect(resolveAction({ type: "navigate", route }, NOW)).toEqual({
        name: route,
      });
    }
  });

  it("detalle exige id entero positivo (params.id o id)", () => {
    expect(
      resolveAction(
        { type: "navigate", route: "shipment-detail", params: { id: 900 } },
        NOW,
      ),
    ).toEqual({ name: "shipment-detail", params: { id: "900" } });
    expect(
      resolveAction({ type: "navigate", route: "cargo-detail", id: "42" }, NOW),
    ).toEqual({ name: "cargo-detail", params: { id: "42" } });
    for (const bad of [0, -1, 1.5, "abc", "12a", null, undefined, "../1", {}]) {
      expect(
        resolveAction(
          { type: "navigate", route: "cargo-detail", params: { id: bad } },
          NOW,
        ),
        `id ${String(bad)}`,
      ).toBeNull();
    }
  });

  it("listados traducen period a fechas locales y validan filtros", () => {
    expect(
      resolveAction(
        {
          type: "navigate",
          route: "shipment-list",
          query: { period: "this_month" },
        },
        NOW,
      ),
    ).toEqual({
      name: "shipment-list",
      query: { date_from: "2026-10-01", date_to: "2026-10-23" },
    });
    expect(
      resolveAction(
        {
          type: "navigate",
          route: "cargo-list",
          query: { period: "today", id_cliente: 77 },
        },
        NOW,
      ),
    ).toEqual({
      name: "cargo-list",
      query: {
        date_from: "2026-10-23",
        date_to: "2026-10-23",
        id_cliente: "77",
      },
    });
  });

  it("fechas explicitas ganan al period; basura se descarta; status no se reenvia", () => {
    const to = resolveAction(
      {
        type: "navigate",
        route: "shipment-list",
        query: {
          period: "this_week",
          date_from: "2026-02-30", // no existe
          date_to: "2026-10-20",
          status: "delivered",
          id_cliente: "1; DROP",
          evil: "x",
        },
      },
      NOW,
    );
    expect(to).toEqual({
      name: "shipment-list",
      query: { date_from: "2026-10-19", date_to: "2026-10-20" },
    });
  });

  it("rangos de periodo (semana desde el lunes, ayer)", () => {
    expect(periodRange("this_week", NOW)).toEqual({
      date_from: "2026-10-19",
      date_to: "2026-10-23",
    });
    expect(periodRange("yesterday", NOW)).toEqual({
      date_from: "2026-10-22",
      date_to: "2026-10-22",
    });
    const monday = new Date(2026, 9, 19);
    expect(periodRange("this_week", monday)).toEqual({
      date_from: "2026-10-19",
      date_to: "2026-10-19",
    });
  });

  it("filtros en rutas que no los aceptan se ignoran", () => {
    expect(
      resolveAction(
        { type: "navigate", route: "tracking", query: { period: "today" } },
        NOW,
      ),
    ).toEqual({ name: "tracking" });
  });

  it("rechaza tipos y rutas desconocidos, incluidas las del ERP legado y proto-pollution", () => {
    const bad = [
      { type: "open", route: "tracking" },
      { type: "navigate", route: "settings-users" },
      { type: "navigate", route: "__proto__" },
      { type: "navigate", route: "constructor" },
      { type: "navigate", route: ["tracking"] },
      { type: "navigate" },
      {
        type: "navigate",
        path: "/erp/tmwe_json/cargo/list",
        destination: "cargo_list",
      },
    ];
    for (const a of bad) expect(resolveAction(a, NOW)).toBeNull();
  });

  it("runActions usa router.push con nombre; nunca path ni window.location", () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const router = { push, hasRoute: (n: string) => n !== "cargo-new" };
    const loc = vi.fn();
    vi.stubGlobal("window", {
      location: {
        set href(v: string) {
          loc(v);
        },
      },
    });

    const used = runActions(
      [
        {
          type: "navigate",
          path: "/erp/tmwe_json/cargo/list",
          destination: "cargo_list",
        }, // obsoleta: ignorada
        { type: "navigate", route: "cargo-new" }, // no existe en este router simulado
        { type: "navigate", route: "shipment-detail", params: { id: 5 } },
        { type: "navigate", route: "tracking" }, // solo se ejecuta la primera valida
      ],
      router,
      { delayMs: 0, now: NOW },
    );
    expect(used).toEqual({ name: "shipment-detail", params: { id: "5" } });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({
      name: "shipment-detail",
      params: { id: "5" },
    });
    expect(loc).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("runActions sin acciones validas no navega", () => {
    const push = vi.fn();
    expect(
      runActions(
        [{ type: "navigate", path: "/erp/x" }],
        { push, hasRoute: () => true },
        { delayMs: 0 },
      ),
    ).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("runActions respeta el retraso para que se vea el mensaje", () => {
    vi.useFakeTimers();
    const push = vi.fn().mockResolvedValue(undefined);
    runActions([{ type: "navigate", route: "tracking" }], {
      push,
      hasRoute: () => true,
    });
    expect(push).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(push).toHaveBeenCalledWith({ name: "tracking" });
    vi.useRealTimers();
  });
});
