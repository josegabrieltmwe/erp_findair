import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({
  http: (...a: unknown[]) => httpMock(...a),
}));

import {
  activeKpi,
  buildConsolidataCountsQuery,
  buildConsolidataListQuery,
  CONSOLIDATA_LIST_DEFAULTS,
  consolidataActiveFilterCount,
  consolidataResetFilters,
  kpiCount,
  kpiToState,
  KPI_KEYS,
  mergePage,
  parseConsolidataListQuery,
  serializeConsolidataListQuery,
  toListSource,
  useConsolidataListStore,
} from "./stores/consolidata_list.store";
import type { QueueCounts, QueueItem } from "./types";

beforeEach(() => {
  setActivePinia(createPinia());
  httpMock.mockReset();
});

describe("parse / serialize / build", () => {
  it("los valores por defecto no salen en la URL", () => {
    expect(
      serializeConsolidataListQuery({ ...CONSOLIDATA_LIST_DEFAULTS }),
    ).toEqual({});
  });

  it("ida y vuelta URL → estado → URL", () => {
    const url = {
      page: "3",
      per_page: "50",
      sort: "totale",
      dir: "asc",
      q: "acme",
      stato: "A,P",
      tipo: "XTRADE",
      hub_terminal: "MXP",
      dest_country: "US",
      orig_paese: "IT",
      id_partner: "4",
      assegnato_a: "me",
      id_cliente: "9",
      date_from: "2026-10-01",
      date_to: "2026-10-31",
      quale_data: "risposta",
      risposta: "vencida",
      conversione: "parcial",
      id_cargo: "77",
      totale_min: "100",
      totale_max: "999.5",
      n_sped_min: "0",
      n_sped_max: "8",
    };
    const s = parseConsolidataListQuery(url);
    expect(serializeConsolidataListQuery(s)).toEqual(url);
  });

  it("orden fuera de la lista blanca y valores inválidos vuelven al defecto", () => {
    const s = parseConsolidataListQuery({
      sort: "p.id; DROP",
      dir: "sideways",
      per_page: "500",
      stato: "A,Z",
      fase: "nope",
      tipo: "BOAT",
      hub_terminal: "M",
      dest_country: "USA",
      assegnato_a: "someone",
      id_cliente: "-3",
      quale_data: "ayer",
      date_from: "01/10/2026",
      risposta: "maybe",
      totale_min: "abc",
    });
    expect(s.sort).toBe("modif_datetime");
    expect(s.dir).toBe("desc");
    expect(s.per_page).toBe(100);
    expect(s.stato).toBe("");
    expect(s.fase).toBe("");
    expect(s.tipo).toBe("");
    expect(s.hub_terminal).toBe("");
    expect(s.dest_country).toBe("");
    expect(s.assegnato_a).toBe("");
    expect(s.id_cliente).toBe("");
    expect(s.quale_data).toBe("insert");
    expect(s.date_from).toBe("");
    expect(s.risposta).toBe("");
    expect(s.totale_min).toBe("");
  });

  it("quale_data solo se serializa y se envía con un rango de fechas", () => {
    const s = { ...CONSOLIDATA_LIST_DEFAULTS, quale_data: "chiuso" as const };
    expect(serializeConsolidataListQuery(s)).toEqual({});
    expect(buildConsolidataListQuery(s).quale_data).toBeUndefined();
    const r = { ...s, date_from: "2026-01-01" };
    expect(serializeConsolidataListQuery(r)).toEqual({
      quale_data: "chiuso",
      date_from: "2026-01-01",
    });
    expect(buildConsolidataListQuery(r).quale_data).toBe("chiuso");
  });

  it("build: sin estado ni fase pide A,P,C (no cancelados); con fase manda stato vacío", () => {
    const def = buildConsolidataListQuery({ ...CONSOLIDATA_LIST_DEFAULTS });
    expect(def).toEqual({
      page: 1,
      per_page: 25,
      sort: "modif_datetime",
      dir: "desc",
      stato: "A,P,C",
    });
    const fase = buildConsolidataListQuery({
      ...CONSOLIDATA_LIST_DEFAULTS,
      fase: "cancelado",
    });
    expect(fase.stato).toBe("");
    expect(fase.fase).toBe("cancelado");
    const own = buildConsolidataListQuery({
      ...CONSOLIDATA_LIST_DEFAULTS,
      stato: "X",
    });
    expect(own.stato).toBe("X");
    expect(own.fase).toBeUndefined();
  });

  it("los recuentos usan los mismos filtros sin estado, fase, página ni orden", () => {
    const s = {
      ...CONSOLIDATA_LIST_DEFAULTS,
      q: "a",
      fase: "respondido",
      stato: "P",
      page: 4,
      id_cliente: "9",
    };
    expect(buildConsolidataCountsQuery(s)).toEqual({ q: "a", id_cliente: "9" });
  });

  it("contador de filtros avanzados y reset conservan tamaño y orden", () => {
    const s = {
      ...CONSOLIDATA_LIST_DEFAULTS,
      stato: "X",
      id_cargo: "5",
      q: "x",
      per_page: 50,
      sort: "id" as const,
    };
    expect(consolidataActiveFilterCount(s)).toBe(2);
    const r = consolidataResetFilters(s);
    expect(r.q).toBe("");
    expect(r.per_page).toBe(50);
    expect(r.sort).toBe("id");
  });
});

describe("mosaicos KPI ↔ fase", () => {
  it("cada mosaico es una fase; «todos» quita fase y estado", () => {
    expect(kpiToState("all")).toEqual({ fase: "", stato: "" });
    expect(kpiToState("respuesta_vencida")).toEqual({
      fase: "respuesta_vencida",
      stato: "",
    });
    expect(kpiToState("inventada")).toEqual({ fase: "", stato: "" });
    for (const k of KPI_KEYS) expect(activeKpi(kpiToState(k))).toBe(k);
  });

  it("con un estado propio elegido no hay mosaico activo", () => {
    expect(activeKpi({ fase: "", stato: "X" })).toBe("");
  });

  it("la cifra sale de queue_counts; «todos» = total", () => {
    const counts = {
      abierto: 1,
      sin_asignar: 2,
      pendiente_respuesta: 3,
      respondido: 4,
      respuesta_vencida: 5,
      por_convertir: 6,
      convertido: 7,
      cancelado: 8,
      total: 26,
    } satisfies QueueCounts;
    expect(kpiCount(counts, "all")).toBe(26);
    expect(kpiCount(counts, "convertido")).toBe(7);
    expect(kpiCount(null, "all")).toBeNull();
  });
});

describe("adaptador ListSource", () => {
  it("expone página, orden y dirección en el formato de ListingDataView", () => {
    const noop = async () => {};
    const src = toListSource({
      state: {
        ...CONSOLIDATA_LIST_DEFAULTS,
        page: 2,
        per_page: 50,
        sort: "totale",
        dir: "asc",
      },
      rows: [],
      total: 120,
      loading: false,
      error: null,
      loadPage: noop,
      loadMore: noop,
      refresh: noop,
      setSort: () => {},
      setPerPage: () => {},
    });
    expect(src).toMatchObject({
      page: 2,
      perPage: 50,
      sort: "totale",
      sortDir: "ASC",
      total: 120,
    });
  });

  it("mergePage reemplaza o acumula y lee count", () => {
    const a = [{ id: 1 }] as QueueItem[];
    const res = {
      items: [{ id: 2 }] as QueueItem[],
      count: 9,
      current_page: 2,
      max_page: 5,
    };
    expect(mergePage(a, res, false)).toEqual({ rows: [{ id: 2 }], total: 9 });
    expect(mergePage(a, res, true).rows.map((r) => r.id)).toEqual([1, 2]);
  });
});

describe("store del listado", () => {
  it("fetchPage llama a view=queue con los parámetros y carga filas", async () => {
    httpMock.mockResolvedValue({
      success: true,
      result: { items: [{ id: 1 }], count: 41, current_page: 1, max_page: 2 },
    });
    const s = useConsolidataListStore();
    s.applyState({ q: "acme" });
    await s.fetchPage();
    expect(s.rows).toHaveLength(1);
    expect(s.total).toBe(41);
    const opts = httpMock.mock.calls[0][1] as {
      query: Record<string, unknown>;
    };
    expect(opts.query).toMatchObject({
      view: "queue",
      q: "acme",
      stato: "A,P,C",
      sort: "modif_datetime",
    });
  });

  it("un error del API queda normalizado en error y vacía la lista", async () => {
    httpMock.mockRejectedValue({
      status: 400,
      details: { success: false, error: "bad", code: "VALIDATION_ERROR" },
    });
    const s = useConsolidataListStore();
    await s.fetchPage();
    expect(s.error?.code).toBe("VALIDATION_ERROR");
    expect(s.rows).toEqual([]);
    expect(s.loading).toBe(false);
  });

  it("fetchCounts guarda counts; si falla deja null sin error de listado", async () => {
    httpMock.mockResolvedValueOnce({
      success: true,
      result: { counts: { total: 3 } },
    });
    const s = useConsolidataListStore();
    await s.fetchCounts();
    expect(s.counts?.total).toBe(3);
    httpMock.mockRejectedValueOnce(new Error("x"));
    await s.fetchCounts();
    expect(s.counts).toBeNull();
    expect(s.error).toBeNull();
  });

  it("setSort ignora campos fuera de la lista blanca", () => {
    const s = useConsolidataListStore();
    s.setSort("p.titolo", "ASC");
    expect(s.state.sort).toBe("modif_datetime");
    expect(s.state.dir).toBe("asc");
    s.setSort("cliente", "DESC");
    expect(s.state.sort).toBe("cliente");
  });

  it("take y bulkAssign pasan por el store", async () => {
    const s = useConsolidataListStore();
    httpMock.mockResolvedValueOnce({ success: true, result: { id: 3 } });
    expect(await s.take(3)).toBeNull();
    httpMock.mockRejectedValueOnce({
      status: 409,
      details: { success: false, error: "x", code: "already_assigned" },
    });
    expect((await s.take(3))?.code).toBe("already_assigned");
    expect(s.takingId).toBeNull();
    httpMock.mockResolvedValueOnce({
      success: true,
      result: {
        results: [
          { id: 1, success: true },
          { id: 2, success: false, code: "invalid_state" },
        ],
      },
    });
    const r = await s.bulkAssign([1, 2], 5);
    expect(r.ok).toBe(1);
    expect(r.failed).toEqual([{ id: 2, code: "invalid_state" }]);
  });
});
