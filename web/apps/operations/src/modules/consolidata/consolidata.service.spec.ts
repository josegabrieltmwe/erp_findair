import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({
  http: (...a: unknown[]) => httpMock(...a),
}));

import {
  consolidataService,
  ConsolidataRequestError,
  createPayload,
  shipmentPayload,
} from "./services/consolidata.service";
import type { QuoteOption, ShipmentForm } from "./types";

beforeEach(() => {
  httpMock.mockReset();
});

describe("shipmentPayload", () => {
  it("normaliza y omite campos vacíos", () => {
    const f: ShipmentForm = {
      ref: " H1 ",
      orig_paese: "it",
      orig_cap: "20100",
      orig_citta: "Milano",
      orig_terminal: "",
      peso: 10,
      colli: 2,
      volume_cm3: null,
      valore: null,
      merce: "",
      data_pronta: "",
      id_spedizione: null,
    };
    expect(shipmentPayload(f)).toEqual({
      ref: "H1",
      orig_paese: "IT",
      orig_cap: "20100",
      orig_citta: "Milano",
      peso: 10,
      colli: 2,
    });
  });
});

describe("consolidataService", () => {
  it("devuelve result si success", async () => {
    httpMock.mockResolvedValue({ success: true, result: { id: 5 } });
    await expect(consolidataService.detail(5)).resolves.toEqual({ id: 5 });
    expect(httpMock).toHaveBeenCalledWith("/unified_consolidation_project", {
      method: "GET",
      query: { id: 5 },
    });
  });

  it("las acciones POST envían {action, ...}", async () => {
    httpMock.mockResolvedValue({ success: true, result: {} });
    await consolidataService.answerQuote(7, { prezzo: 100, nota: "ok" });
    expect(httpMock).toHaveBeenCalledWith("/unified_consolidation_project", {
      method: "POST",
      body: { action: "answer_quote", id: 7, prezzo: 100, nota: "ok" },
    });
    await consolidataService.convert(7, 33);
    expect(httpMock).toHaveBeenLastCalledWith(
      "/unified_consolidation_project",
      {
        method: "POST",
        body: { action: "convert", id: 7, id_cargo: 33 },
      },
    );
  });

  it("un error HTTP del API sale como ConsolidataRequestError normalizado", async () => {
    httpMock.mockRejectedValue({
      message: "Request failed",
      status: 409,
      details: {
        success: false,
        error: "gia assegnato",
        code: "already_assigned",
        details: { assegnato_a: 3 },
      },
    });
    try {
      await consolidataService.take(1);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConsolidataRequestError);
      expect((err as ConsolidataRequestError).info.code).toBe(
        "already_assigned",
      );
      expect((err as ConsolidataRequestError).info.status).toBe(409);
    }
  });

  it("una respuesta {success:false} con HTTP 200 también es error", async () => {
    httpMock.mockResolvedValue({
      success: false,
      error: "x",
      code: "NOT_FOUND",
    });
    try {
      await consolidataService.detail(1);
      expect.unreachable();
    } catch (err) {
      expect((err as ConsolidataRequestError).info.code).toBe("NOT_FOUND");
    }
  });
});

const PATH = "/unified_consolidation_project";
const lastBody = () =>
  (httpMock.mock.calls.at(-1)?.[1] as { body: unknown }).body;
const lastQuery = () =>
  (httpMock.mock.calls.at(-1)?.[1] as { query: unknown }).query;

describe("consolidataService — acciones nuevas", () => {
  beforeEach(() => httpMock.mockResolvedValue({ success: true, result: {} }));

  it("operate manda solo lo que hay: id, id_cargo si se elige y reservar solo si true", async () => {
    await consolidataService.operate(7);
    expect(lastBody()).toEqual({ action: "operate", id: 7 });
    await consolidataService.operate(7, { id_cargo: 55, reservar: false });
    expect(lastBody()).toEqual({ action: "operate", id: 7, id_cargo: 55 });
    await consolidataService.operate(7, { id_cargo: null, reservar: true });
    expect(lastBody()).toEqual({ action: "operate", id: 7, reservar: true });
  });

  it("update_profile manda id, id_sped y solo el perfil recibido", async () => {
    await consolidataService.updateProfile(7, 12, { mittente_tel: "+39 02" });
    expect(lastBody()).toEqual({
      action: "update_profile",
      id: 7,
      id_sped: 12,
      profilo: { mittente_tel: "+39 02" },
    });
  });

  it("create_from_option envía la opción completa (con legs), envíos, destino, título y cliente", async () => {
    const option: QuoteOption = {
      key: "hub_MXP",
      label: "Hub MXP",
      hub_terminal: "MXP",
      legs: [],
      totale_tratte: 100,
      costi_fissi: {} as QuoteOption["costi_fissi"],
      totale: 120,
      valuta: "EUR",
      note: [],
      incomplete: false,
      dominated: false,
      dominated_by: null,
      giorni_totali: 3,
      eta: null,
    };
    option.legs = [{ tipo: "AIR" } as unknown as QuoteOption["legs"][number]];
    const payload = {
      option,
      shipments: [
        {
          ref: "H1",
          origin: { country: "IT", zip: "20100", city: "Milano" },
          weight: 10,
          packages: [
            { quantity: 1, weight: 10, length: 50, width: 40, height: 30 },
          ],
        },
      ],
      destination: { country: "US", zip: "10001", city: "New York" },
      titolo: "T",
      customer_id: 9,
    };
    await consolidataService.createFromOption(payload);
    expect(lastBody()).toEqual({ action: "create_from_option", ...payload });
  });

  it("bulk_assign envía ids y user_id", async () => {
    await consolidataService.bulkAssign([1, 2], 3);
    expect(lastBody()).toEqual({
      action: "bulk_assign",
      ids: [1, 2],
      user_id: 3,
    });
  });

  it("create limpia vacíos y normaliza mayúsculas", () => {
    expect(
      createPayload({
        titolo: " P1 ",
        tipo: "CONS",
        id_cliente: 9,
        hub_terminal: "mxp",
        dest_country: "",
        eori_dichiarante: " it123 ",
        note_specialist: "",
      }),
    ).toEqual({
      titolo: "P1",
      tipo: "CONS",
      id_cliente: 9,
      hub_terminal: "MXP",
      eori_dichiarante: "IT123",
    });
  });

  it("add_leg, remove_leg, set_eori, request_quote y assign", async () => {
    const leg = {
      tipo: "AIR" as const,
      origin: { country: "IT", zip: "", city: "", terminal: "MXP" },
      destination: { country: "US", zip: "", city: "", terminal: "JFK" },
      weight: 100,
    };
    await consolidataService.addLeg(4, leg);
    expect(lastBody()).toEqual({ action: "add_leg", id: 4, leg });
    await consolidataService.removeLeg(4, 8);
    expect(lastBody()).toEqual({ action: "remove_leg", id: 4, id_tratta: 8 });
    await consolidataService.setEori(4, " it1 ");
    expect(lastBody()).toEqual({
      action: "set_eori",
      id: 4,
      eori_dichiarante: "IT1",
    });
    await consolidataService.requestQuote(4);
    expect(lastBody()).toEqual({ action: "request_quote", id: 4 });
    await consolidataService.assign(4, 12);
    expect(lastBody()).toEqual({ action: "assign", id: 4, user_id: 12 });
  });

  it("waive_warning omite id_prog_sped cuando el aviso es del proyecto (E4)", async () => {
    await consolidataService.waiveWarning(4, "QUOTE_EXPIRED", null, "ok ok");
    expect(lastBody()).toEqual({
      action: "waive_warning",
      id: 4,
      codice: "QUOTE_EXPIRED",
      motivo: "ok ok",
    });
    await consolidataService.waiveWarning(4, "NO_WEIGHT", 17, "motivo");
    expect(lastBody()).toEqual({
      action: "waive_warning",
      id: 4,
      codice: "NO_WEIGHT",
      id_prog_sped: 17,
      motivo: "motivo",
    });
  });

  it("vistas GET: queue, queue_counts, by_cargo, by_spedizione, conversion, log, staff_users", async () => {
    await consolidataService.queue({ page: 2, stato: "" });
    expect(httpMock).toHaveBeenLastCalledWith(PATH, {
      method: "GET",
      query: { page: 2, stato: "", view: "queue" },
    });
    const ctrl = new AbortController();
    await consolidataService.queueCounts({ q: "x" }, { signal: ctrl.signal });
    expect(httpMock).toHaveBeenLastCalledWith(PATH, {
      method: "GET",
      query: { q: "x", view: "queue_counts" },
      signal: ctrl.signal,
    });
    await consolidataService.byCargo(77);
    expect(lastQuery()).toEqual({ view: "by_cargo", id_cargo: 77 });
    await consolidataService.bySpedizione(5);
    expect(lastQuery()).toEqual({ view: "by_spedizione", id_spedizione: 5 });
    await consolidataService.conversion(4);
    expect(lastQuery()).toEqual({ view: "conversion", id: 4 });
    await consolidataService.log(4, 3, 20);
    expect(lastQuery()).toEqual({ view: "log", id: 4, page: 3, per_page: 20 });
    await consolidataService.staffUsers("ana");
    expect(lastQuery()).toEqual({ view: "staff_users", q: "ana" });
    await consolidataService.staffUsers();
    expect(lastQuery()).toEqual({ view: "staff_users" });
  });
});
