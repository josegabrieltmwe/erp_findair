import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let reply: unknown = { success: true, data: { items: [], total: 0, page: 1, per_page: 50, tipo: "A" } };

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    return reply;
  }),
}));

import {
  buildCustomersWithoutMarginQuery,
  customersWithoutMarginService,
  marginConfigRoute,
  pageCount,
} from "@shared/customers_without_margin/services/customersWithoutMargin.service";

beforeEach(() => {
  calls.length = 0;
  reply = { success: true, data: { items: [], total: 0, page: 1, per_page: 50, tipo: "A" } };
});

describe("buildCustomersWithoutMarginQuery", () => {
  it("valores por defecto: tipo A, página 1, 50 por página, sin q ni titular", () => {
    expect(buildCustomersWithoutMarginQuery()).toEqual({ tipo: "A", page: 1, per_page: 50 });
  });

  it("acota per_page a 1..200 y page a >= 1, y descarta un tipo desconocido", () => {
    expect(
      buildCustomersWithoutMarginQuery({ tipo: "X" as never, page: 0, perPage: 999 }),
    ).toEqual({ tipo: "A", page: 1, per_page: 200 });
    expect(buildCustomersWithoutMarginQuery({ perPage: 0 }).per_page).toBe(1);
  });

  it("q recortada y id_titolare solo si es > 0", () => {
    expect(buildCustomersWithoutMarginQuery({ tipo: "E", q: "  acme ", idTitolare: 0 })).toEqual({
      tipo: "E",
      page: 1,
      per_page: 50,
      q: "acme",
    });
    expect(buildCustomersWithoutMarginQuery({ q: "   ", idTitolare: 9069 })).toEqual({
      tipo: "A",
      page: 1,
      per_page: 50,
      id_titolare: 9069,
    });
  });
});

describe("customersWithoutMarginService.list", () => {
  it("llama a /api_customers_without_margin con la query normalizada", async () => {
    await customersWithoutMarginService.list({ tipo: "S", q: "12", page: 3, perPage: 20 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api_customers_without_margin");
    expect(calls[0].opts.query).toEqual({ tipo: "S", q: "12", page: 3, per_page: 20 });
  });

  it("mapea la respuesta del contrato", async () => {
    reply = {
      success: true,
      data: {
        items: [
          {
            id: 42,
            ragione_sociale: "ACME SRL",
            id_titolare: 1,
            titolare: "TMWE",
            alta: "2025-03-01",
            cargo_shipments_12m: 17,
          },
        ],
        total: 120,
        page: 2,
        per_page: 50,
        tipo: "A",
      },
    };
    const res = await customersWithoutMarginService.list({ page: 2 });
    expect(res).toEqual({
      items: [
        {
          id: 42,
          ragione_sociale: "ACME SRL",
          id_titolare: 1,
          titolare: "TMWE",
          alta: "2025-03-01",
          cargo_shipments_12m: 17,
        },
      ],
      total: 120,
      page: 2,
      perPage: 50,
      tipo: "A",
    });
  });

  it("tolera campos ausentes (alta null, números como texto, sin data)", async () => {
    reply = { success: true, data: { items: [{ id: "5", ragione_sociale: "X", cargo_shipments_12m: "3" }] } };
    const res = await customersWithoutMarginService.list({ tipo: "E" });
    expect(res.items[0]).toEqual({
      id: 5,
      ragione_sociale: "X",
      id_titolare: 0,
      titolare: "",
      alta: null,
      cargo_shipments_12m: 3,
    });
    expect(res.total).toBe(1);
    expect(res.tipo).toBe("E");

    reply = { success: true };
    const empty = await customersWithoutMarginService.list();
    expect(empty).toEqual({ items: [], total: 0, page: 1, perPage: 50, tipo: "A" });
  });
});

describe("utilidades", () => {
  it("pageCount nunca es 0", () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(120, 50)).toBe(3);
  });

  it("marginConfigRoute abre la pestaña de márgenes; el tipo viaja solo si no es A", () => {
    expect(marginConfigRoute(42)).toEqual({
      name: "anagrafica-detail-tab",
      params: { id: "42", tab: "margini_cargo" },
      query: {},
    });
    expect(marginConfigRoute(42, "E").query).toEqual({ tipo: "E" });
  });
});
