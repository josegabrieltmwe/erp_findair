import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const listMock = vi.fn();
vi.mock("../services/payments.service", () => ({
  paymentsApi: {
    list: (...a: unknown[]) => listMock(...a),
    methods: vi.fn().mockResolvedValue([]),
    reopen: vi.fn(),
  },
}));

import {
  effectiveFilters,
  isOpenRow,
  usePaymentsStore,
} from "./payments.store";

const row = (id: number, data_close = "0000-00-00") => ({
  id,
  id_fattura: id,
  tipo: "A",
  importo: 100,
  scadenza: "2026-01-01",
  data_close,
  id_pagam_metodi: null,
  numero: String(id),
  data_fattura: "2026-01-01",
  id_anagrafica: 1,
  valuta_sigla: "EUR",
  rag_soc: "ACME",
  days_overdue: 0,
  status: "pending",
});

beforeEach(() => {
  setActivePinia(createPinia());
  listMock.mockReset();
  listMock.mockResolvedValue({
    rows: [row(1), row(2, "2026-01-05")],
    total: 2,
    totalAmount: 200,
  });
});

describe("effectiveFilters", () => {
  it("cada vista fija el tipo o el estado", () => {
    expect(effectiveFilters("debit", { tipo: "A" }).tipo).toBe("P");
    expect(effectiveFilters("credit", {}).tipo).toBe("A");
    const o = effectiveFilters("overdue", { tipo: "A", id_anagrafica: 3 });
    expect(o.statop).toBe("SC");
    expect(o.tipo).toBe("A");
    expect(o.id_anagrafica).toBe(3);
  });

  it("credit sin estado explícito pide solo abiertas", () => {
    expect(effectiveFilters("credit", {}).statop).toBe("O");
  });

  it("credit respeta el estado elegido o recibido por URL", () => {
    expect(effectiveFilters("credit", { statop: "C" }).statop).toBe("C");
    expect(effectiveFilters("credit", { statop: "SC" }).statop).toBe("SC");
  });

  it("overdue fuerza tipo A aunque el filtro traiga P", () => {
    expect(effectiveFilters("overdue", { tipo: "P" }).tipo).toBe("A");
    expect(effectiveFilters("overdue", {}).tipo).toBe("A");
  });

  it("overdue conserva el filtro de días 10/30", () => {
    expect(effectiveFilters("overdue", { statop: "30" }).statop).toBe("30");
    expect(effectiveFilters("overdue", { statop: "O" }).statop).toBe("SC");
  });

  it("no muta los filtros de entrada y los presets de URL pasan", () => {
    const input = { scad_dal: "2026-01-01", scad_al: "2026-02-01", id_anagrafica: 5 };
    const out = effectiveFilters("credit", input);
    expect(input).toEqual({ scad_dal: "2026-01-01", scad_al: "2026-02-01", id_anagrafica: 5 });
    expect(out).toMatchObject({ ...input, tipo: "A", statop: "O" });
  });
});

describe("usePaymentsStore", () => {
  it("load pide la página con orden y filtros efectivos", async () => {
    const s = usePaymentsStore();
    s.filters = { id_anagrafica: 9 };
    await s.load();
    const [filters, params] = listMock.mock.calls[0];
    expect(filters).toMatchObject({ tipo: "A", statop: "O", id_anagrafica: 9 });
    expect(params).toMatchObject({
      page: 1,
      perPage: 25,
      sort: "scadenza",
      sortDir: "ASC",
    });
    expect(s.total).toBe(2);
    expect(s.totalAmount).toBe(200);
  });

  it("cambiar filtros vuelve a la página 1 y vacía la selección", async () => {
    const s = usePaymentsStore();
    await s.load();
    s.setPage(3);
    s.setSelected([1]);
    s.setFilters({ scad_dal: "2026-01-01" });
    expect(s.page).toBe(1);
    expect(s.selected).toEqual([]);
  });

  it("la selección solo conserva cuotas abiertas visibles", async () => {
    const s = usePaymentsStore();
    s.selected = [1, 2, 99];
    await s.load();
    expect(s.selected).toEqual([1]);
  });

  it("setSort reinicia la página y recarga con la dirección", async () => {
    const s = usePaymentsStore();
    s.setSort("importo", "DESC");
    await Promise.resolve();
    expect(listMock.mock.calls.at(-1)?.[1]).toMatchObject({
      sort: "importo",
      sortDir: "DESC",
      page: 1,
    });
  });

  it("un error de carga deja el listado vacío", async () => {
    listMock.mockRejectedValue(new Error("boom"));
    const s = usePaymentsStore();
    await s.load();
    expect(s.error).toBe("load_failed");
    expect(s.rows).toEqual([]);
  });
});

describe("isOpenRow", () => {
  it("0000-00-00 y vacío son abiertas", () => {
    expect(isOpenRow({ data_close: "0000-00-00" })).toBe(true);
    expect(isOpenRow({ data_close: "" })).toBe(true);
    expect(isOpenRow({ data_close: "2026-01-01" })).toBe(false);
  });
});
