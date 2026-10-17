import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({
  http: (...a: unknown[]) => httpMock(...a),
}));

import { useConsolidataStore } from "./stores/consolidata.store";

const project = (over: Record<string, unknown> = {}) => ({
  id: 4,
  id_cliente: 9,
  titolo: "P",
  tipo: "CONS",
  stato: "P",
  totale: 100,
  valuta: "EUR",
  tratte: [],
  log: [],
  ...over,
});

/** Responde según la query/acción para simular el API. */
function route(handlers: Record<string, unknown>) {
  httpMock.mockImplementation(
    async (
      _path: string,
      opts: {
        method: string;
        query?: Record<string, unknown>;
        body?: { action: string };
      },
    ) => {
      const key =
        opts.method === "GET"
          ? opts.query?.view
            ? `GET:${opts.query.view}`
            : "GET:detail"
          : `POST:${opts.body?.action}`;
      const h = handlers[key];
      if (h instanceof Error) throw h;
      if (h === undefined) throw new Error(`sin manejador para ${key}`);
      return { success: true, result: h };
    },
  );
}

beforeEach(() => {
  setActivePinia(createPinia());
  httpMock.mockReset();
});

describe("consolidata store", () => {
  it("fetchQueue carga items y paginación", async () => {
    route({
      "GET:queue": {
        items: [{ id: 1 }],
        count: 41,
        current_page: 2,
        max_page: 3,
      },
    });
    const s = useConsolidataStore();
    await s.fetchQueue();
    expect(s.items).toHaveLength(1);
    expect(s.count).toBe(41);
    expect(s.maxPage).toBe(3);
  });

  it("setFilters vuelve a la página 1", () => {
    const s = useConsolidataStore();
    s.page = 4;
    s.setFilters({ stato: "A", assegnato_a: "me", id_cliente: null });
    expect(s.page).toBe(1);
    expect(s.filters.stato).toBe("A");
  });

  it("openProject carga detalle y vistas derivadas", async () => {
    route({
      "GET:detail": project(),
      "GET:shipments": {
        spedizioni: [],
        riparto: [],
        criterio: "IATA_6000",
        totale_tratte: 0,
        totale_riparto: 0,
      },
      "GET:readiness": {
        avisos: [],
        bloqueantes: 0,
        pendientes: 0,
        listo: true,
      },
      "GET:notes": { note: [{ id: 1, nota: "n", user: 1, datetime: null }] },
      "GET:meta": {
        api_version: "1.1",
        states: {},
        actions: {},
        limits: { max_legs: 20, max_shipments: 200, currency: "EUR" },
        warning_codes: [],
      },
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    expect(s.project?.id).toBe(4);
    expect(s.shipments?.criterio).toBe("IATA_6000");
    expect(s.readiness?.listo).toBe(true);
    expect(s.notes).toHaveLength(1);
    expect(s.meta?.api_version).toBe("1.1");
  });

  it("un fallo de acción deja el error normalizado y devuelve false", async () => {
    const apiErr = Object.assign(new Error("x"), {
      status: 409,
      details: {
        success: false,
        error: "ya asignado",
        code: "already_assigned",
      },
    });
    route({
      "GET:detail": project(),
      "GET:shipments": {
        spedizioni: [],
        riparto: [],
        criterio: "X",
        totale_tratte: 0,
        totale_riparto: 0,
      },
      "GET:readiness": {
        avisos: [],
        bloqueantes: 0,
        pendientes: 0,
        listo: true,
      },
      "GET:notes": { note: [] },
      "GET:meta": {
        api_version: "1.1",
        states: {},
        actions: {},
        limits: { max_legs: 20, max_shipments: 200, currency: "EUR" },
        warning_codes: [],
      },
      "POST:take": apiErr,
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    expect(await s.take()).toBe(false);
    expect(s.error?.code).toBe("already_assigned");
    expect(s.saving).toBe(false);
    s.clearError();
    expect(s.error).toBeNull();
  });

  it("answerQuote adopta el detalle devuelto y refresca vistas", async () => {
    route({
      "GET:detail": project(),
      "GET:shipments": {
        spedizioni: [],
        riparto: [],
        criterio: "X",
        totale_tratte: 0,
        totale_riparto: 0,
      },
      "GET:readiness": {
        avisos: [],
        bloqueantes: 0,
        pendientes: 0,
        listo: true,
      },
      "GET:notes": { note: [] },
      "GET:meta": {
        api_version: "1.1",
        states: {},
        actions: {},
        limits: { max_legs: 20, max_shipments: 200, currency: "EUR" },
        warning_codes: [],
      },
      "POST:answer_quote": project({ risposta_prezzo: 250 }),
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    expect(await s.answerQuote({ prezzo: 250 })).toBe(true);
    expect(s.project?.risposta_prezzo).toBe(250);
  });

  it("convert guarda el resultado por house", async () => {
    route({
      "GET:detail": project({ stato: "C" }),
      "GET:shipments": {
        spedizioni: [],
        riparto: [],
        criterio: "X",
        totale_tratte: 0,
        totale_riparto: 0,
      },
      "GET:readiness": {
        avisos: [],
        bloqueantes: 0,
        pendientes: 0,
        listo: true,
      },
      "GET:notes": { note: [] },
      "GET:meta": {
        api_version: "1.1",
        states: {},
        actions: {},
        limits: { max_legs: 20, max_shipments: 200, currency: "EUR" },
        warning_codes: [],
      },
      "POST:convert": {
        id: 4,
        id_cargo: 77,
        houses: [{ ref: "H1", id_spedizione: 5, success: true }],
        enlazadas: 1,
        pendientes: 0,
        completo: true,
      },
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    const res = await s.convert(77);
    expect(res?.completo).toBe(true);
    expect(s.conversion?.houses[0].ref).toBe("H1");
  });
});
