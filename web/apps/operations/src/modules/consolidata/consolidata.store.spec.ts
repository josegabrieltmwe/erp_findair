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
    expect(s.metaError).toBeNull();
  });

  it("si meta falla queda metaError (la página lo enseña) y no se pisa el error de acciones", async () => {
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
      "GET:meta": Object.assign(new Error("x"), {
        status: 500,
        details: { success: false, error: "boom", code: "INTERNAL_ERROR" },
      }),
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    expect(s.meta).toBeNull();
    expect(s.metaError?.code).toBe("INTERNAL_ERROR");
    expect(s.error).toBeNull();
  });

  it("operate guarda el resultado y recarga cabecera y pasos; sin la vista conversion marca stepsUnavailable", async () => {
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
      "POST:operate": {
        id: 4,
        id_cargo: 9,
        houses: [],
        pendientes: 0,
        completo: true,
      },
      "GET:conversion": Object.assign(new Error("x"), {
        status: 400,
        details: { success: false, error: "view", code: "VALIDATION_ERROR" },
      }),
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    const res = await s.operate({ reservar: false });
    expect(res?.completo).toBe(true);
    expect(s.operateResult?.id_cargo).toBe(9);
    expect(s.stepsUnavailable).toBe(true);
    expect(s.operating).toBe(false);
  });

  it("loadLog cae al log del detalle si el API no tiene view=log", async () => {
    route({
      "GET:detail": project({
        log: [
          {
            id: 1,
            id_tratta: null,
            azione: "take",
            prima: null,
            dopo: null,
            user: 2,
            datetime: null,
          },
        ],
      }),
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
      "GET:log": Object.assign(new Error("x"), {
        status: 400,
        details: { success: false, error: "view", code: "VALIDATION_ERROR" },
      }),
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    await s.loadLog(1);
    expect(s.logPage?.items).toHaveLength(1);
    expect(s.logPage?.max_page).toBe(1);
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
