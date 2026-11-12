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
        pendientes: [],
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

  it("operate que falla deja el error visible aunque se recarguen cabecera y pasos", async () => {
    route({
      "GET:detail": project({ stato: "C" }),
      "GET:shipments": {
        spedizioni: [],
        riparto: [],
        criterio: "X",
        totale_tratte: 0,
        totale_riparto: 0,
      },
      "GET:readiness": { avisos: [], bloqueantes: 0, pendientes: 0, listo: true },
      "GET:notes": { note: [] },
      "GET:meta": {
        api_version: "1.1",
        states: {},
        actions: {},
        limits: { max_legs: 20, max_shipments: 200, currency: "EUR" },
        warning_codes: [],
      },
      "POST:operate": Object.assign(new Error("x"), {
        status: 409,
        details: {
          success: false,
          error: "il progetto e gia in fase di conversione",
          code: "operation_in_progress",
        },
      }),
      "GET:conversion": { passi: [] },
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    const res = await s.operate({ reservar: false });
    expect(res).toBeUndefined();
    expect(s.error?.code).toBe("operation_in_progress");
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

  const baseViews = {
    "GET:shipments": {
      spedizioni: [],
      riparto: [],
      criterio: "X",
      totale_tratte: 0,
      totale_riparto: 0,
    },
    "GET:readiness": { avisos: [], bloqueantes: 0, pendientes: 0, listo: true },
    "GET:notes": { note: [] },
    "GET:meta": {
      api_version: "1.1",
      states: {},
      actions: {},
      limits: { max_legs: 20, max_shipments: 200, currency: "EUR" },
      warning_codes: [],
    },
  };
  const serverError = (status: number) =>
    Object.assign(new Error("x"), {
      status,
      details: { success: false, error: "fallo", code: "INTERNAL_ERROR" },
    });

  it("un fallo real de view=conversion (500) queda en stepsError y no se disfraza de «no disponible»", async () => {
    route({
      ...baseViews,
      "GET:detail": project({ stato: "C" }),
      "GET:conversion": serverError(500),
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    await s.loadSteps();
    expect(s.stepsUnavailable).toBe(false);
    expect(s.stepsError?.status).toBe(500);
    expect(s.error).toBeNull();
    // un reintento correcto limpia el fallo
    route({
      ...baseViews,
      "GET:detail": project({ stato: "C" }),
      "GET:conversion": { passi: [] },
    });
    await s.loadSteps();
    expect(s.stepsError).toBeNull();
    expect(s.steps).toEqual([]);
  });

  it("un fallo real de view=log (500) queda en logError y no cae al log del detalle", async () => {
    route({
      ...baseViews,
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
      "GET:log": serverError(500),
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    await s.loadLog(1);
    expect(s.logError?.status).toBe(500);
    expect(s.logPage).toBeNull();
    expect(s.logLoading).toBe(false);
  });

  it("updateProfile adopta las houses devueltas y recarga el cumplimiento", async () => {
    const view = {
      spedizioni: [
        {
          id: 12,
          ref: "H1",
          id_spedizione: null,
          profilo: { mittente_tel: "456" },
        },
      ],
      riparto: [],
      criterio: "X",
      totale_tratte: 0,
      totale_riparto: 0,
    };
    route({
      ...baseViews,
      "GET:detail": project({ stato: "C" }),
      "POST:update_profile": view,
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    const ok = await s.updateProfile(12, { mittente_tel: "456" });
    expect(ok).toBe(true);
    expect(s.shipments?.spedizioni[0]?.profilo?.mittente_tel).toBe("456");
    const sent = httpMock.mock.calls
      .map((c) => c[1] as { body?: { action: string; profilo?: unknown } })
      .find((o) => o.body?.action === "update_profile");
    expect(sent?.body).toMatchObject({
      id: 4,
      id_sped: 12,
      profilo: { mittente_tel: "456" },
    });
  });

  it("updateProfile con error de validación devuelve false y deja el error", async () => {
    route({
      ...baseViews,
      "GET:detail": project({ stato: "C" }),
      "POST:update_profile": Object.assign(new Error("x"), {
        status: 422,
        details: {
          success: false,
          error: "mail",
          code: "VALIDATION_ERROR",
          details: {
            fields: { "spedizione.profilo.mittente_mail": "email non valida" },
          },
        },
      }),
    });
    const s = useConsolidataStore();
    await s.openProject(4);
    expect(await s.updateProfile(12, { mittente_mail: "x" })).toBe(false);
    expect(s.error?.fields["spedizione.profilo.mittente_mail"]).toBe(
      "email non valida",
    );
  });

  it("una respuesta lenta del proyecto anterior no pisa al proyecto abierto después", async () => {
    let releaseSlow: () => void = () => {};
    const slowGate = new Promise<void>((r) => (releaseSlow = r));
    httpMock.mockImplementation(
      async (
        _path: string,
        opts: { method: string; query?: Record<string, unknown> },
      ) => {
        const view = opts.query?.view as string | undefined;
        const id = Number(opts.query?.id);
        if (!view) {
          if (id === 4) await slowGate;
          return { success: true, result: project({ id, titolo: `P${id}` }) };
        }
        const r = (baseViews as Record<string, unknown>)[`GET:${view}`];
        return { success: true, result: r };
      },
    );
    const s = useConsolidataStore();
    const first = s.openProject(4); // lenta
    await s.openProject(5); // rápida: es la que queda abierta
    releaseSlow();
    await first;
    expect(s.project?.id).toBe(5);
    expect(s.detailLoading).toBe(false);
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
